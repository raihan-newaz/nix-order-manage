import { orderNotification } from '../orders/orderNotification';
import axios from 'axios';
import prisma from '../../prisma';
import { logAudit } from '../audit/auditService';
import { sendOrderNotification } from '../messaging/messageService';
import { io } from '../../server';

export class WooCommerceService {
  private storeUrl: string;
  private consumerKey: string;
  private consumerSecret: string;

  constructor(storeUrl: string, consumerKey: string, consumerSecret: string) {
    this.storeUrl = storeUrl.replace(/\/$/, '');
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }

  private getAuthHeader() {
    const token = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    return {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.storeUrl}/wp-json/wc/v3/system_status`, {
        headers: this.getAuthHeader(),
        timeout: 15000,
      });
      return {
        success: true,
        environment: response.data?.environment,
        storeName: response.data?.environment?.site_title || 'WooCommerce Store',
        currency: response.data?.settings?.currency || 'BDT',
      };
    } catch (error: any) {
      try {
        const testOrders = await axios.get(`${this.storeUrl}/wp-json/wc/v3/orders?per_page=1`, {
          headers: this.getAuthHeader(),
          timeout: 10000,
        });
        return {
          success: true,
          storeName: 'Connected WooCommerce Store',
          totalOrdersDetected: testOrders.headers['x-wp-total'] || 1,
        };
      } catch (err2: any) {
        return {
          success: false,
          message: error.response?.data?.message || error.message || 'Failed to connect to WooCommerce store',
        };
      }
    }
  }

  async processIncomingOrder(wooOrder: any) {
    const wooOrderId = Number(wooOrder.id);
    const customerPhone =
      wooOrder.billing?.phone ||
      wooOrder.shipping?.phone ||
      `017${Math.floor(10000000 + Math.random() * 90000000)}`;

    const firstName = wooOrder.billing?.first_name || wooOrder.shipping?.first_name || '';
    const lastName = wooOrder.billing?.last_name || wooOrder.shipping?.last_name || '';
    const customerName = `${firstName} ${lastName}`.trim() || 'WooCommerce Customer';

    const line1 = wooOrder.shipping?.address_1 || wooOrder.billing?.address_1 || '';
    const line2 = wooOrder.shipping?.address_2 || wooOrder.billing?.address_2 || '';
    const city = wooOrder.shipping?.city || wooOrder.billing?.city || 'Dhaka';
    const state = wooOrder.shipping?.state || wooOrder.billing?.state || '';
    const customerAddress = `${line1} ${line2} ${city}`.trim() || 'Address not provided';

    // Check customer existence
    let customer = await prisma.customer.findUnique({
      where: { phone: customerPhone },
    });

    let isFraudSuspect = false;
    let isDuplicate = false;

    if (customer) {
      if (customer.isBlacklisted || customer.riskScore > 60 || customer.returnedOrders > 2) {
        isFraudSuspect = true;
      }
      const recent = await prisma.order.findMany({
        where: {
          customerPhone,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (recent.length > 0) isDuplicate = true;
    } else {
      customer = await prisma.customer.create({
        data: {
          name: customerName,
          phone: customerPhone,
          email: wooOrder.billing?.email || undefined,
          address: customerAddress,
          city,
          district: state,
        },
      });
    }

    // Process line items with Fashion Variation (Color, Size) parsing
    let subtotal = 0;
    let totalCogs = 0;
    const orderItems = [];

    if (Array.isArray(wooOrder.line_items)) {
      for (const line of wooOrder.line_items) {
        const qty = line.quantity || 1;
        const unitPrice = parseFloat(line.price) || (parseFloat(line.total) / qty) || 0;

        let product = null;
        let variant = null;

        // Try finding matching variant by variation_id or SKU
        if (line.variation_id && line.variation_id > 0) {
          variant = await prisma.productVariant.findFirst({
            where: { wooVariantId: Number(line.variation_id) },
            include: { product: true },
          });
          if (variant) {
            product = variant.product;
          }
        }

        if (!product && line.sku) {
          variant = await prisma.productVariant.findUnique({
            where: { sku: line.sku },
            include: { product: true },
          });
          if (variant) {
            product = variant.product;
          } else {
            product = await prisma.product.findUnique({ where: { sku: line.sku } });
          }
        }

        if (!product && line.product_id) {
          product = await prisma.product.findUnique({ where: { wooProductId: line.product_id } });
        }

        // Extract Color and Size from line meta_data
        let color: string | null = null;
        let size: string | null = null;

        if (Array.isArray(line.meta_data)) {
          for (const m of line.meta_data) {
            const key = (m.display_key || m.key || '').toLowerCase();
            const val = String(m.display_value || m.value || '');
            if (key.includes('color') || key.includes('colour') || key.includes('pa_color')) {
              color = val;
            }
            if (key.includes('size') || key.includes('pa_size')) {
              size = val;
            }
          }
        }

        if (variant) {
          color = color || variant.color;
          size = size || variant.size;
        }

        const variantName = color && size ? `${color} / ${size}` : color ? color : size ? size : null;
        const unitBuyPrice = variant ? variant.buyPrice : product ? product.buyPrice : Math.round(unitPrice * 0.45);
        const lineSubtotal = qty * unitPrice;
        const lineCogs = qty * unitBuyPrice;

        subtotal += lineSubtotal;
        totalCogs += lineCogs;

        orderItems.push({
          productId: product ? product.id : null,
          variantId: variant ? variant.id : null,
          productName: line.name || 'Fashion Item',
          variantName,
          color,
          size,
          productSku: line.sku || (variant ? variant.sku : product ? product.sku : `WC-SKU-${line.product_id}`),
          quantity: qty,
          unitPrice,
          unitBuyPrice,
          totalPrice: lineSubtotal,
          totalBuyPrice: lineCogs,
        });

        // Deduct specific variant & parent stock
        if (variant) {
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: { stockQuantity: { decrement: qty } },
          });
        }
        if (product) {
          await prisma.product.update({
            where: { id: product.id },
            data: { stockQuantity: { decrement: qty } },
          });
        }
      }
    }

    const grandTotal = parseFloat(wooOrder.total) || subtotal;
    const deliveryCharge = parseFloat(wooOrder.shipping_total) || 0;
    const discount = parseFloat(wooOrder.discount_total) || 0;
    const orderNumber = `WC-${wooOrderId}`;

    // Map WooCommerce status
    const statusMap: Record<string, string> = {
      pending: 'PENDING',
      processing: 'CONFIRMED',
      'on-hold': 'HOLD',
      completed: 'DELIVERED',
      cancelled: 'CANCELLED',
      refunded: 'RETURNED',
      failed: 'CANCELLED',
    };
    const mappedStatus = statusMap[wooOrder.status] || 'PENDING';

    const order = await prisma.order.upsert({
      where: { wooOrderId },
      create: {
        orderNumber,
        wooOrderId,
        customerId: customer.id,
        customerName,
        customerPhone,
        customerAddress,
        district: state || 'Dhaka',
        city: city || 'Dhaka',
        status: mappedStatus,
        paymentMethod: wooOrder.payment_method_title || 'COD',
        paymentStatus: wooOrder.status === 'completed' ? 'PAID' : 'PENDING',
        subtotal,
        discount,
        deliveryCharge,
        grandTotal,
        codAmount: grandTotal,
        cogsCost: totalCogs,
        customerNote: wooOrder.customer_note || '',
        isFraudSuspect,
        isDuplicate,
        items: {
          create: orderItems,
        },
      },
      update: {
        customerName,
        customerPhone,
        customerAddress,
        grandTotal,
        paymentStatus: wooOrder.status === 'completed' ? 'PAID' : 'PENDING',
      },
      include: { items: { include: { variant: true } } },
    });

    await logAudit({
      action: 'CREATE',
      entity: 'ORDER',
      entityId: order.id,
      details: { wooOrderId, orderNumber, grandTotal },
    });

    // Send Real-Time Socket Event to all connected browser tabs
    try {
      if (io) {
        io.emit('order:new', orderNotification(order));
      }
    } catch (sockErr) {
      console.warn('Socket emit error:', sockErr);
    }

    // Auto notification
    try {
      await sendOrderNotification({ eventTrigger: 'ORDER_PLACED', order });
    } catch (e) {
      console.error('Notification error:', e);
    }

    return order;
  }

  async syncAllOrders(perPage = 50, page = 1) {
    try {
      const response = await axios.get(
        `${this.storeUrl}/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}&orderby=date&order=desc`,
        { headers: this.getAuthHeader(), timeout: 30000 }
      );

      const wooOrders = response.data;
      const syncedOrders = [];

      if (Array.isArray(wooOrders)) {
        for (const wo of wooOrders) {
          const synced = await this.processIncomingOrder(wo);
          syncedOrders.push(synced);
        }
      }

      await prisma.wooCommerceStore.updateMany({
        data: { lastSyncedAt: new Date() },
      });

      return {
        success: true,
        totalFetched: wooOrders.length,
        syncedCount: syncedOrders.length,
        syncedOrders,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to sync orders from WooCommerce',
      };
    }
  }

  async syncAllProducts(perPage = 100, page = 1) {
    try {
      const response = await axios.get(
        `${this.storeUrl}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}`,
        { headers: this.getAuthHeader(), timeout: 40000 }
      );

      const wooProducts = response.data;
      const syncedProducts = [];

      if (Array.isArray(wooProducts)) {
        for (const wp of wooProducts) {
          const sku = wp.sku || `WC-PROD-${wp.id}`;
          const regularPrice = parseFloat(wp.regular_price) || parseFloat(wp.price) || 0;
          const salePrice = parseFloat(wp.sale_price) || parseFloat(wp.price) || regularPrice;
          const buyPrice = Math.round(regularPrice * 0.45);
          let stockQuantity = wp.manage_stock && wp.stock_quantity !== null ? wp.stock_quantity : 50;
          const image = wp.images && wp.images.length > 0 ? wp.images[0].src : null;
          const category = wp.categories && wp.categories.length > 0 ? wp.categories[0].name : 'Fashion';
          const productAttributes = Array.isArray(wp.attributes)
            ? wp.attributes.map((attribute: any) => ({
                name: String(attribute.name || '').trim(),
                options: Array.isArray(attribute.options) ? attribute.options.map(String) : [],
                visible: Boolean(attribute.visible),
                variation: Boolean(attribute.variation),
              })).filter((attribute: any) => attribute.name)
            : [];
          const isVariableProduct = wp.type === 'variable';

          const prod = await prisma.product.upsert({
            where: { sku },
            create: {
              name: wp.name || 'Fashion Product',
              sku,
              barcode: `880${Date.now().toString().slice(-9)}`,
              description: wp.short_description || wp.description || '',
              category,
              buyPrice,
              regularPrice,
              salePrice,
              stockQuantity,
              image,
              attributes: JSON.stringify(productAttributes),
              productType: isVariableProduct ? 'VARIABLE' : 'SIMPLE',
              wooProductId: wp.id,
              isWooSynced: true,
              status: 'ACTIVE',
            },
            update: {
              name: wp.name,
              regularPrice,
              salePrice,
              stockQuantity,
              image,
              attributes: JSON.stringify(productAttributes),
              productType: isVariableProduct ? 'VARIABLE' : 'SIMPLE',
              wooProductId: wp.id,
              isWooSynced: true,
            },
          });

          // If Variable Product with Variations (Color & Size), fetch each variation
          if (wp.type === 'variable' && Array.isArray(wp.variations) && wp.variations.length > 0) {
            try {
              const varRes = await axios.get(
                `${this.storeUrl}/wp-json/wc/v3/products/${wp.id}/variations?per_page=100`,
                { headers: this.getAuthHeader(), timeout: 25000 }
              );

              if (Array.isArray(varRes.data)) {
                let totalVarStock = 0;
                for (const v of varRes.data) {
                  let color: string | null = null;
                  let size: string | null = null;
                  const variationAttributes: Record<string, string> = {};

                  if (Array.isArray(v.attributes)) {
                    for (const a of v.attributes) {
                      const attributeName = String(a.name || productAttributes.find((item: any) => item.name?.toLowerCase().includes(String(a.slug || '').replace(/^pa_/, '').toLowerCase()))?.name || '').trim();
                      const name = attributeName.toLowerCase();
                      if (attributeName && a.option) variationAttributes[attributeName] = String(a.option);
                      if (name.includes('color') || name.includes('colour') || name.includes('pa_color')) {
                        color = String(a.option || '');
                      }
                      if (name.includes('size') || name.includes('pa_size')) {
                        size = String(a.option || '');
                      }
                    }
                  }

                  const varRegularPrice = parseFloat(v.regular_price) || parseFloat(v.price) || regularPrice;
                  const varSalePrice = parseFloat(v.sale_price) || parseFloat(v.price) || salePrice;
                  const varBuyPrice = Math.round(varRegularPrice * 0.45);
                  const varStock = v.manage_stock && v.stock_quantity !== null ? v.stock_quantity : 20;
                  const varSku = v.sku || `${sku}-${color || 'VAR'}-${size || v.id}`;
                  const varName = Object.values(variationAttributes).length ? `${wp.name} - ${Object.values(variationAttributes).join(' / ')}` : `${wp.name} - Variant #${v.id}`;

                  totalVarStock += varStock;

                  await prisma.productVariant.upsert({
                    where: { sku: varSku },
                    create: {
                      productId: prod.id,
                      name: varName,
                      sku: varSku,
                      barcode: `880${Date.now().toString().slice(-9)}`,
                      color,
                      size,
                      attributes: JSON.stringify(variationAttributes),
                      buyPrice: varBuyPrice,
                      regularPrice: varRegularPrice,
                      salePrice: varSalePrice,
                      stockQuantity: varStock,
                      wooVariantId: v.id,
                    },
                    update: {
                      name: varName,
                      color,
                      size,
                      attributes: JSON.stringify(variationAttributes),
                      regularPrice: varRegularPrice,
                      salePrice: varSalePrice,
                      stockQuantity: varStock,
                      wooVariantId: v.id,
                    },
                  });
                }

                // Update aggregate parent stock
                await prisma.product.update({
                  where: { id: prod.id },
                  data: { stockQuantity: totalVarStock },
                });
              }
            } catch (varErr) {
              console.warn(`Could not fetch variations for product #${wp.id}:`, varErr);
            }
          }

          syncedProducts.push(prod);
        }
      }

      return {
        success: true,
        totalFetched: wooProducts.length,
        syncedCount: syncedProducts.length,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to sync products from WooCommerce',
      };
    }
  }

  async updateWooOrderStatus(wooOrderId: number, status: string) {
    try {
      const wooStatusMap: Record<string, string> = {
        CONFIRMED: 'processing',
        PACKAGING: 'processing',
        IN_TRANSIT: 'on-hold',
        DELIVERED: 'completed',
        CANCELLED: 'cancelled',
        RETURNED: 'refunded',
      };

      const mappedStatus = wooStatusMap[status] || 'processing';

      await axios.put(
        `${this.storeUrl}/wp-json/wc/v3/orders/${wooOrderId}`,
        { status: mappedStatus },
        { headers: this.getAuthHeader(), timeout: 10000 }
      );
      return { success: true };
    } catch (err: any) {
      console.warn(`Failed to push status to WooCommerce for #${wooOrderId}:`, err.message);
      return { success: false, message: err.message };
    }
  }
}
