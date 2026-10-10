import prisma from '../../prisma';
import { SteadfastAdapter } from './adapters/steadfast';
import type { SteadfastOrderPayload } from './adapters/steadfast';
import { getSteadfastAdapter } from './steadfastSession';
import { callPathao } from './pathaoSession';
import { getPathaoSession } from './pathaoSession';
import type { PathaoOrderPayload } from './adapters/pathao';
import { getRedXAdapter } from './redxSession';
import { logAudit } from '../audit/auditService';
import { sendOrderNotification } from '../messaging/messageService';

export interface SendToCourierOptions {
  orderId: string;
  courierName: 'STEADFAST' | 'PATHAO' | 'REDX' | 'MANUAL';
  weight?: number;
  deliveryType?: number;
  itemType?: 1 | 2;
  storeId?: number;
  itemDescription?: string;
  secondaryPhone?: string;
  cityId?: number;
  zoneId?: number;
  areaId?: number;
  areaName?: string;
  specialInstruction?: string;
  userId?: string;
  userName?: string;
}

export async function dispatchOrderToCourier(options: SendToCourierOptions) {
  const { orderId, courierName, weight = 0.5, specialInstruction, userId, userName } = options;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true },
  });

  if (!order) {
    throw new Error('Order not found');
  }
  if (order.trashedAt || ['CANCELLED', 'RETURNED', 'DELIVERED'].includes(order.status)) throw new Error('Closed or trashed orders cannot be dispatched');

  const locationProvider = courierName;
  const location = async (level: 'DISTRICT' | 'THANA' | 'AREA', externalId?: number) => externalId && locationProvider !== 'MANUAL' ?
    prisma.courierLocation.findUnique({ where: { provider_level_externalId: { provider: locationProvider, level, externalId: String(externalId) } } }) : null;
  const [selectedDistrict, selectedThana, selectedArea] = await Promise.all([
    location('DISTRICT', options.cityId), location('THANA', options.zoneId), location('AREA', options.areaId),
  ]);
  if (courierName === 'REDX') {
    if (!selectedArea?.active) throw new Error('Select a RedX delivery area before dispatch');
  } else if ((options.cityId && !selectedDistrict) || (options.zoneId && (!selectedThana || selectedThana.parentExternalId !== String(options.cityId))) ||
    (options.areaId && (!selectedArea || selectedArea.parentExternalId !== String(options.zoneId)))) throw new Error('Choose a valid courier district, thana and area combination');
  if (courierName === 'PATHAO' && (!selectedDistrict || !selectedThana)) throw new Error('Select Pathao city and zone before dispatch');
  const locationData = courierName === 'REDX' && selectedArea ? { area: selectedArea.name, ...(selectedArea.districtName ? { district: selectedArea.districtName } : {}) } : selectedDistrict ? { district: selectedDistrict.name, city: selectedDistrict.name,
    ...(selectedThana ? { zone: selectedThana.name } : {}), ...(selectedArea || options.areaName ? { area: selectedArea?.name || options.areaName } : {}) } : {};

  const courierConfig = await prisma.courierConfig.findUnique({
    where: { provider: courierName },
  });

  let trackingCode = '';
  let consignmentId = '';
  let courierCharge = order.deliveryCharge || 80;
  if (order.courierConsignmentId) throw new Error('This order is already booked with a courier');

  if (courierName === 'STEADFAST') {
    const { adapter } = await getSteadfastAdapter(true);
    const codAmount = Math.max(0, order.grandTotal - order.advancePaid);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(order.orderNumber) || !order.customerName.trim() || order.customerName.length > 100 ||
      !/^01[3-9]\d{8}$/.test(order.customerPhone) || !order.customerAddress.trim() || order.customerAddress.length > 490 || codAmount > 1_000_000) {
      throw new Error('Steadfast requires a valid invoice, recipient name/phone/address and COD not above ৳1,000,000');
    }
    const claim = await prisma.order.updateMany({
      where: { id: orderId, courierName: null, courierConsignmentId: null },
      data: { courierName: 'STEADFAST', courierStatus: 'BOOKING_REQUESTED' },
    });
    if (!claim.count) throw new Error('Order already has a courier booking or unresolved request');
    let res: Awaited<ReturnType<SteadfastAdapter['createOrder']>>;
    try {
      res = await adapter.createOrder({
        invoice: order.orderNumber,
        recipient_name: order.customerName,
        recipient_phone: order.customerPhone,
        recipient_address: [order.customerAddress, ...[options.areaName, selectedThana?.name, selectedDistrict?.name]
          .filter((part): part is string => Boolean(part) && !order.customerAddress.toLowerCase().includes(String(part).toLowerCase()))]
          .join(', ').slice(0, 490),
        cod_amount: codAmount,
        note: (specialInstruction || order.internalNote || '').slice(0, 480),
        ...(/^01[3-9]\d{8}$/.test(options.secondaryPhone || order.customer?.alternativePhone || '') ? { alternative_phone: options.secondaryPhone || order.customer?.alternativePhone || undefined } : {}),
        ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer?.email || '') ? { recipient_email: order.customer?.email || undefined } : {}),
        item_description: (options.itemDescription?.trim() || order.items.map((item) => item.productName).join(', ')).slice(0, 255),
        total_lot: order.items.reduce((sum, item) => sum + item.quantity, 0) || 1,
        delivery_type: options.deliveryType === 1 ? 1 : 0,
      });
    } catch (error) {
      await prisma.order.updateMany({ where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null }, data: { courierStatus: 'BOOKING_UNCERTAIN' } });
      throw error;
    }
    if (!res.success) {
      const duplicateInvoice = JSON.stringify(res.errors || '').includes('THIS_INVOICE_ALREADY_EXISTS');
      await prisma.order.updateMany({
        where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null },
        data: res.statusCode && res.statusCode < 500 && !duplicateInvoice ? { courierName: null, courierStatus: null } : { courierStatus: 'BOOKING_UNCERTAIN' },
      });
      throw new Error(res.message || 'Steadfast booking failed. Check the merchant panel before retrying.');
    }
    trackingCode = res.trackingCode;
    consignmentId = res.consignmentId;
    await prisma.order.updateMany({
      where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null },
      data: { courierTrackingCode: trackingCode, courierConsignmentId: consignmentId,
        courierTrackingLink: res.trackingLink, courierStatus: res.status.toUpperCase(),
        ...locationData,
        status: order.status === 'PENDING' ? 'CONFIRMED' : order.status },
    });
  } else if (courierName === 'PATHAO') {
    if (!courierConfig?.isEnabled || !courierConfig.storeId || !/^\d+$/.test(courierConfig.storeId)) throw new Error('Configure an active Pathao pickup store before dispatch');
    const pickupStoreId = options.storeId || Number(courierConfig.storeId);
    if (!Number.isInteger(pickupStoreId) || pickupStoreId < 1) throw new Error('Select a valid Pathao pickup store');
    if (pickupStoreId === Number(courierConfig.storeId) && courierConfig.storeActive === false) throw new Error('The selected Pathao pickup store is inactive');
    if (pickupStoreId !== Number(courierConfig.storeId)) {
      const stores = await callPathao((adapter, token) => adapter.getStores(token), true);
      if (!stores.success || !stores.data?.some((store: any) => Number(store.store_id) === pickupStoreId && Number(store.is_active) === 1)) {
        throw new Error('Select an active Pathao pickup store');
      }
    }
    if (!Number.isFinite(weight) || weight < 0.5 || weight > 10) throw new Error('Pathao parcel weight must be between 0.5 and 10 kg');
    const claim = await prisma.order.updateMany({
      where: { id: orderId, courierConsignmentId: null, OR: [{ courierName: null }, { courierName: 'PATHAO', courierStatus: 'BOOKING_FAILED' }] },
      data: { courierName: 'PATHAO', courierStatus: 'BOOKING_REQUESTED', courierStoreId: String(pickupStoreId) },
    });
    if (!claim.count) throw new Error('This order is already booked or has an unresolved Pathao booking. Check its delivery timeline before retrying.');
    const amountToCollect = Math.max(0, Math.round(order.grandTotal - order.advancePaid));
    let res: Awaited<ReturnType<import('./adapters/pathao').PathaoAdapter['createOrder']>>;
    try {
      res = await callPathao((adapter, token) => adapter.createOrder({
        store_id: pickupStoreId,
        merchant_order_id: order.orderNumber,
        recipient_name: order.customerName,
        recipient_phone: order.customerPhone,
        recipient_address: order.customerAddress,
        ...(options.cityId ? { recipient_city: options.cityId } : {}),
        ...(options.zoneId ? { recipient_zone: options.zoneId } : {}),
        ...(options.areaId ? { recipient_area: options.areaId } : {}),
        delivery_type: options.deliveryType === 12 ? 12 : 48,
        item_type: options.itemType === 1 ? 1 : 2,
        item_quantity: order.items.reduce((sum, item) => sum + item.quantity, 0) || 1,
        item_weight: weight,
        amount_to_collect: amountToCollect,
        special_instruction: specialInstruction || '',
        item_description: (options.itemDescription?.trim() || order.items.map((item) => item.productName).join(', ')).slice(0, 180),
      }, token), true);
    } catch (error) {
      await prisma.order.updateMany({ where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null }, data: { courierStatus: 'BOOKING_UNCERTAIN' } });
      throw error;
    }
    if (!res.success || !res.consignmentId) {
      await prisma.order.updateMany({
        where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null },
        data: res.status && res.status < 500 ? { courierName: null, courierStatus: null, courierStoreId: null } : { courierStatus: 'BOOKING_UNCERTAIN' },
      });
      throw new Error(res.message || 'Pathao did not return a consignment ID. Check Pathao before retrying.');
    }

    consignmentId = String(res.consignmentId);
    trackingCode = consignmentId;
    if (res.deliveryFee != null && Number.isFinite(Number(res.deliveryFee))) courierCharge = Number(res.deliveryFee);
    await prisma.order.updateMany({
      where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null },
      data: {
        courierTrackingCode: trackingCode, courierConsignmentId: consignmentId,
        courierStatus: 'PENDING', courierCharge,
        ...locationData,
        status: order.status === 'PENDING' ? 'CONFIRMED' : order.status,
      },
    });
  } else if (courierName === 'REDX') {
    const { adapter } = await getRedXAdapter(true);
    if (!selectedArea || !Number.isFinite(weight) || weight <= 0 || weight > 20 ||
      !order.customerName.trim() || !/^01[3-9]\d{8}$/.test(order.customerPhone) || !order.customerAddress.trim()) {
      throw new Error('RedX requires a delivery area, valid recipient details and weight between 0 and 20 kg');
    }
    let pickupStoreId: number | undefined;
    if (options.storeId) {
      const stores = await adapter.getPickupStores();
      if (!stores.success || !stores.data?.some(store => Number(store.id) === options.storeId)) throw new Error('Choose a valid RedX pickup store');
      pickupStoreId = options.storeId;
    }
    const codAmount = Math.max(0, Math.round(order.grandTotal - order.advancePaid));
    const claim = await prisma.order.updateMany({ where: { id: orderId, courierName: null, courierConsignmentId: null },
      data: { courierName: 'REDX', courierStatus: 'BOOKING_REQUESTED', courierStoreId: pickupStoreId ? String(pickupStoreId) : null } });
    if (!claim.count) throw new Error('Order already has a courier booking or unresolved request');
    let res: Awaited<ReturnType<typeof adapter.createParcel>>;
    try {
      res = await adapter.createParcel({
        customer_name: order.customerName.trim(), customer_phone: order.customerPhone,
        customer_address: order.customerAddress.trim(),
        delivery_area: selectedArea.name, delivery_area_id: Number(selectedArea.externalId),
        merchant_invoice_id: order.orderNumber, cash_collection_amount: String(codAmount),
        parcel_weight: String(Math.round(weight * 1000)), value: String(Math.max(0, Math.round(order.subtotal))),
        instruction: (specialInstruction || '').slice(0, 500),
        ...(pickupStoreId ? { pickup_store_id: pickupStoreId } : {}),
        parcel_details_json: order.items.map(item => ({ name: item.productName.slice(0, 150), category: 'Fashion', value: Math.max(0, Math.round(item.totalPrice)) })),
      });
    } catch (error) {
      await prisma.order.updateMany({ where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null }, data: { courierStatus: 'BOOKING_UNCERTAIN' } });
      throw error;
    }
    if (!res.success || !res.trackingId) {
      await prisma.order.updateMany({ where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null },
        data: 'status' in res && res.status && res.status < 500 ? { courierName: null, courierStatus: null, courierStoreId: null } : { courierStatus: 'BOOKING_UNCERTAIN' } });
      throw new Error(res.message || 'RedX booking failed. Check the merchant panel before retrying.');
    }
    trackingCode = String(res.trackingId);
    consignmentId = trackingCode;
    await prisma.order.updateMany({ where: { id: orderId, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null },
      data: { courierTrackingCode: trackingCode, courierConsignmentId: consignmentId,
        courierStatus: 'PICKUP_PENDING', courierTrackingLink: `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(trackingCode)}`,
        ...locationData, status: order.status === 'PENDING' ? 'CONFIRMED' : order.status } });
  } else {
    // Manual
    trackingCode = `MANUAL-${Date.now().toString().slice(-6)}`;
    consignmentId = trackingCode;
  }

  // Update order
  const updatedOrder = courierName !== 'MANUAL' ? await prisma.order.findUniqueOrThrow({ where: { id: orderId } }) : await prisma.order.update({
    where: { id: orderId },
    data: {
      courierName,
      courierTrackingCode: trackingCode,
      courierConsignmentId: consignmentId,
      courierStatus: 'IN_TRANSIT',
      courierCharge,
      ...locationData,
      status: 'IN_TRANSIT',
    },
  });
  if (courierName !== 'MANUAL' && updatedOrder.courierConsignmentId !== consignmentId) throw new Error('Courier returned a different consignment than the saved webhook event');

  // Log audit
  await logAudit({
    userId,
    userName,
    action: 'COURIER_SEND',
    entity: 'ORDER',
    entityId: orderId,
    details: {
      courier: courierName,
      trackingCode,
      consignmentId,
    },
  });

  // Send automated WhatsApp/SMS
  try {
    await sendOrderNotification({
      eventTrigger: 'DISPATCHED_TRACKING',
      order: updatedOrder,
    });
  } catch (msgErr) {
    console.error('Notification dispatch error:', msgErr);
  }

  return updatedOrder;
}

export async function dispatchBulkToPathao(orderIds: string[]) {
  const ids = [...new Set(orderIds)];
  if (!ids.length || ids.length > 50) throw new Error('Select 1 to 50 orders for Pathao bulk dispatch');
  const config = await prisma.courierConfig.findUnique({ where: { provider: 'PATHAO' } });
  if (!config?.isEnabled || !config.storeId || !/^\d+$/.test(config.storeId) || config.storeActive === false) {
    throw new Error('Configure an active Pathao pickup store before bulk dispatch');
  }
  await getPathaoSession(true);
  const acceptedIds: string[] = [];
  const errors: Array<{ orderId: string; error: string }> = [];
  const orders: PathaoOrderPayload[] = [];

  for (const orderId of ids) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true } });
    if (!order || order.trashedAt || ['CANCELLED', 'RETURNED', 'DELIVERED'].includes(order.status)) {
      errors.push({ orderId, error: 'Order not found or closed' }); continue;
    }
    if (order.customerName.trim().length < 3 || !/^01[3-9]\d{8}$/.test(order.customerPhone) || order.customerAddress.trim().length < 10) {
      errors.push({ orderId, error: 'Pathao needs a recipient name, valid Bangladesh phone and full address' }); continue;
    }
    const claim = await prisma.order.updateMany({
      where: { id: orderId, courierName: null, courierConsignmentId: null },
      data: { courierName: 'PATHAO', courierStatus: 'BOOKING_REQUESTED', courierStoreId: config.storeId },
    });
    if (!claim.count) { errors.push({ orderId, error: 'Order already has a courier booking or pending request' }); continue; }
    acceptedIds.push(orderId);
    orders.push({
      store_id: Number(config.storeId), merchant_order_id: order.orderNumber,
      recipient_name: order.customerName, recipient_phone: order.customerPhone,
      ...(order.customer?.alternativePhone && /^01[3-9]\d{8}$/.test(order.customer.alternativePhone) ? { recipient_secondary_phone: order.customer.alternativePhone } : {}),
      recipient_address: order.customerAddress, delivery_type: 48, item_type: 2,
      item_quantity: order.items.reduce((sum, item) => sum + item.quantity, 0) || 1,
      item_weight: 0.5, amount_to_collect: Math.max(0, Math.round(order.grandTotal - order.advancePaid)),
      item_description: order.items.map((item) => item.productName).join(', ').slice(0, 180),
    });
  }
  if (!orders.length) return { accepted: 0, errors };

  let response: Awaited<ReturnType<import('./adapters/pathao').PathaoAdapter['createBulkOrders']>>;
  try {
    response = await callPathao((adapter, token) => adapter.createBulkOrders(orders, token), true);
  } catch (error) {
    await prisma.order.updateMany({ where: { id: { in: acceptedIds }, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null }, data: { courierStatus: 'BOOKING_UNCERTAIN' } });
    throw error;
  }
  if (!response.success) {
    await prisma.order.updateMany({
      where: { id: { in: acceptedIds }, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null },
      data: response.status && response.status < 500 ? { courierName: null, courierStatus: null, courierStoreId: null } : { courierStatus: 'BOOKING_UNCERTAIN' },
    });
    throw new Error(response.message || 'Pathao bulk request was not accepted. Check Pathao before retrying.');
  }
  return { accepted: acceptedIds.length, errors };
}

export async function dispatchBulkToSteadfast(orderIds: string[], userId?: string, userName?: string) {
  const ids = [...new Set(orderIds)];
  if (!ids.length || ids.length > 100) throw new Error('Select 1 to 100 orders for Steadfast bulk dispatch');
  const { adapter } = await getSteadfastAdapter(true);
  const errors: Array<{ orderId: string; error: string }> = [];
  const claimed = new Map<string, { id: string; status: string }>();
  const payloads: SteadfastOrderPayload[] = [];

  for (const orderId of ids) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true } });
    if (!order || order.trashedAt || ['CANCELLED', 'RETURNED', 'DELIVERED'].includes(order.status)) {
      errors.push({ orderId, error: 'Order not found or closed' }); continue;
    }
    const codAmount = Math.max(0, order.grandTotal - order.advancePaid);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(order.orderNumber) || !order.customerName.trim() || order.customerName.length > 100 ||
      !/^01[3-9]\d{8}$/.test(order.customerPhone) || !order.customerAddress.trim() || order.customerAddress.length > 490 || codAmount > 1_000_000) {
      errors.push({ orderId, error: 'Invalid Steadfast invoice, recipient details or COD' }); continue;
    }
    const lock = await prisma.order.updateMany({ where: { id: orderId, courierName: null, courierConsignmentId: null }, data: { courierName: 'STEADFAST', courierStatus: 'BOOKING_REQUESTED' } });
    if (!lock.count) { errors.push({ orderId, error: 'Order already booked or awaiting courier confirmation' }); continue; }
    claimed.set(order.orderNumber, { id: order.id, status: order.status });
    payloads.push({
      invoice: order.orderNumber, recipient_name: order.customerName, recipient_phone: order.customerPhone,
      recipient_address: order.customerAddress, cod_amount: codAmount, note: (order.internalNote || '').slice(0, 480),
      ...(/^01[3-9]\d{8}$/.test(order.customer?.alternativePhone || '') ? { alternative_phone: order.customer?.alternativePhone || undefined } : {}),
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer?.email || '') ? { recipient_email: order.customer?.email || undefined } : {}),
      item_description: order.items.map((item) => item.productName).join(', ').slice(0, 255),
      total_lot: order.items.reduce((sum, item) => sum + item.quantity, 0) || 1, delivery_type: 0,
    });
  }
  if (!payloads.length) return { dispatched: 0, errors };
  const claimedIds = [...claimed.values()].map((entry) => entry.id);
  const response = await adapter.createBulkOrders(payloads, true);
  if (!response.success) {
    await prisma.order.updateMany({ where: { id: { in: claimedIds }, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null }, data: response.statusCode && response.statusCode < 500 ? { courierName: null, courierStatus: null } : { courierStatus: 'BOOKING_UNCERTAIN' } });
    throw new Error(response.message || 'Steadfast bulk request failed. Check the merchant panel before retrying.');
  }
  const entries = new Map<string, any>(response.data.map((entry: any) => [String(entry.invoice), entry]));
  let dispatched = 0;
  for (const payload of payloads) {
    const claim = claimed.get(payload.invoice)!;
    const result = entries.get(payload.invoice);
    if (result?.status === 'success' && result.consignment_id && result.tracking_code) {
      const updated = await prisma.order.update({ where: { id: claim.id }, data: {
        courierConsignmentId: String(result.consignment_id), courierTrackingCode: String(result.tracking_code),
        courierTrackingLink: typeof result.tracking_link === 'string' ? result.tracking_link : null,
        courierStatus: 'IN_REVIEW', status: claim.status === 'PENDING' ? 'CONFIRMED' : claim.status,
      } });
      dispatched++;
      try { await sendOrderNotification({ eventTrigger: 'DISPATCHED_TRACKING', order: updated }); } catch { /* booking is still valid */ }
    } else {
      const reason = Array.isArray(result?.error) ? result.error.join(', ') : String(result?.error || 'No per-order response from Steadfast');
      const uncertain = !result || reason.includes('THIS_INVOICE_ALREADY_EXISTS');
      await prisma.order.updateMany({ where: { id: claim.id, courierStatus: 'BOOKING_REQUESTED', courierConsignmentId: null }, data: uncertain ? { courierStatus: 'BOOKING_UNCERTAIN' } : { courierName: null, courierStatus: null } });
      errors.push({ orderId: claim.id, error: reason });
    }
  }
  await logAudit({ userId, userName, action: 'COURIER_SEND', entity: 'ORDER', details: { courier: 'STEADFAST', bulk: true, dispatched, failed: errors.length } });
  return { dispatched, errors };
}
