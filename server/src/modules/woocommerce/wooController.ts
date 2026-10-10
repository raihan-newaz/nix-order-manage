import { Request, Response } from 'express';
import prisma from '../../prisma';
import { WooCommerceService } from './wooService';
import { config } from '../../config';
import { isAllowedRemoteUrl, keepExistingSecret, maskSecret, revealSecret, safeEqualBase64Hmac } from '../../utils/security';

export const handleWooWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId as string | undefined;
    const orderData = req.body;

    const store = await prisma.wooCommerceStore.findFirst({
      where: storeId ? { id: storeId } : { isActive: true },
    });

    if (!store) {
      res.status(404).json({ success: false, message: 'Store configuration not found' });
      return;
    }
    const signature = String(req.headers['x-wc-webhook-signature'] || '');
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!store.webhookSecret || !rawBody || !safeEqualBase64Hmac(rawBody, store.webhookSecret, signature)) {
      res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }

    const service = new WooCommerceService(store.storeUrl, revealSecret(store.consumerKey), revealSecret(store.consumerSecret));
    const order = await service.processIncomingOrder(orderData);

    res.json({ success: true, message: 'WooCommerce webhook processed', orderId: order.id });
  } catch (error: any) {
    console.error('WooCommerce webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const syncOrdersFromWoo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, perPage = 50 } = req.body;

    const store = await prisma.wooCommerceStore.findFirst({ where: { isActive: true } });
    if (!store) {
      res.status(400).json({
        success: false,
        message: 'No active WooCommerce store configured. Please add your credentials in Settings first.',
      });
      return;
    }

    const service = new WooCommerceService(store.storeUrl, revealSecret(store.consumerKey), revealSecret(store.consumerSecret));
    const result = await service.syncAllOrders(Number(perPage), Number(page));

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: `Successfully synchronized ${result.syncedCount} orders from WooCommerce!`,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const syncProductsFromWoo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, perPage = 100 } = req.body;

    const store = await prisma.wooCommerceStore.findFirst({ where: { isActive: true } });
    if (!store) {
      res.status(400).json({
        success: false,
        message: 'No active WooCommerce store configured. Please add your credentials in Settings first.',
      });
      return;
    }

    const service = new WooCommerceService(store.storeUrl, revealSecret(store.consumerKey), revealSecret(store.consumerSecret));
    const result = await service.syncAllProducts(Number(perPage), Number(page));

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: `Successfully imported & synced ${result.syncedCount} products from WooCommerce into ERP inventory!`,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testWooConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeUrl, consumerKey, consumerSecret } = req.body;

    let targetUrl = storeUrl;
    let targetKey = consumerKey;
    let targetSecret = consumerSecret;

    if (!targetUrl || !targetKey || !targetSecret || String(targetKey).includes('••') || String(targetSecret).includes('••')) {
      const store = await prisma.wooCommerceStore.findFirst();
      if (store) {
        targetUrl = targetUrl || store.storeUrl;
        targetKey = keepExistingSecret(targetKey, store.consumerKey);
        targetSecret = keepExistingSecret(targetSecret, store.consumerSecret);
      }
    }

    if (!targetUrl || !targetKey || !targetSecret) {
      res.status(400).json({ success: false, message: 'Store URL, Consumer Key, and Consumer Secret are required' });
      return;
    }

    const service = new WooCommerceService(targetUrl, revealSecret(targetKey), revealSecret(targetSecret));
    const result = await service.testConnection();

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: `Connection successful! Connected to WooCommerce Store (${result.storeName || 'Online Store'}).`,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await prisma.wooCommerceStore.findFirst();
    res.json({ success: true, store: store ? { ...store, consumerKey: maskSecret(store.consumerKey), consumerSecret: maskSecret(store.consumerSecret), webhookSecret: maskSecret(store.webhookSecret) } : null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveStoreConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeName, storeUrl, consumerKey, consumerSecret, webhookSecret, autoSyncStock, autoSyncOrders, isActive } = req.body;

    if (!isAllowedRemoteUrl(storeUrl, config.isDev)) { res.status(400).json({ success: false, message: 'Use a public HTTPS WooCommerce store URL' }); return; }

    const existing = await prisma.wooCommerceStore.findFirst();
    let store;

    if (existing) {
      store = await prisma.wooCommerceStore.update({
        where: { id: existing.id },
        data: {
          storeName,
          storeUrl,
          consumerKey: keepExistingSecret(consumerKey, existing.consumerKey) || '',
          consumerSecret: keepExistingSecret(consumerSecret, existing.consumerSecret) || '',
          webhookSecret: keepExistingSecret(webhookSecret, existing.webhookSecret),
          autoSyncStock: autoSyncStock ?? true,
          autoSyncOrders: autoSyncOrders ?? true,
          isActive: isActive ?? true,
        },
      });
    } else {
      store = await prisma.wooCommerceStore.create({
        data: {
          storeName: storeName || 'WooCommerce Store',
          storeUrl,
          consumerKey: keepExistingSecret(consumerKey) || '',
          consumerSecret: keepExistingSecret(consumerSecret) || '',
          webhookSecret: keepExistingSecret(webhookSecret),
          autoSyncStock: autoSyncStock ?? true,
          autoSyncOrders: autoSyncOrders ?? true,
          isActive: isActive ?? true,
        },
      });
    }

    res.json({ success: true, message: 'WooCommerce store configuration saved successfully!', store: { ...store, consumerKey: maskSecret(store.consumerKey), consumerSecret: maskSecret(store.consumerSecret), webhookSecret: maskSecret(store.webhookSecret) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
