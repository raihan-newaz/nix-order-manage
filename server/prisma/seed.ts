import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create Default Users
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword || seedPassword.length < 10 || !/[a-z]/.test(seedPassword) || !/[A-Z]/.test(seedPassword) || !/\d/.test(seedPassword)) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 10 characters and include uppercase, lowercase, and a number');
  }
  const hashedPassword = await bcrypt.hash(seedPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nix.bd' },
    update: {},
    create: {
      name: 'Super Administrator',
      email: 'admin@nix.bd',
      password: hashedPassword,
      phone: '01711000000',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@nix.bd' },
    update: {},
    create: {
      name: 'Tanvir Hossain',
      email: 'manager@nix.bd',
      password: hashedPassword,
      phone: '01811000000',
      role: 'OPERATIONS_MANAGER',
      status: 'ACTIVE',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@nix.bd' },
    update: {},
    create: {
      name: 'Fatima Akter',
      email: 'agent@nix.bd',
      password: hashedPassword,
      phone: '01911000000',
      role: 'CALL_CENTER_AGENT',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Seed users created. Password was read securely from SEED_ADMIN_PASSWORD.');

  // 2. Default Warehouses
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-DHK-01' },
    update: {},
    create: {
      name: 'Central Dhaka Warehouse',
      code: 'WH-DHK-01',
      address: 'Plot 14, Road 3, Dhanmondi, Dhaka',
      phone: '01700112233',
      isDefault: true,
    },
  });

  const ctgWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-CTG-01' },
    update: {},
    create: {
      name: 'Chittagong Distribution Hub',
      code: 'WH-CTG-01',
      address: 'Agrabad C/A, Chittagong',
      phone: '01800112233',
      isDefault: false,
    },
  });

  // 3. Courier Configs
  const couriers = [
    { provider: 'STEADFAST', isEnabled: false, isDefault: true, baseUrl: 'https://portal.packzy.com/api/v1' },
    { provider: 'PATHAO', isEnabled: true, isDefault: false, baseUrl: 'https://api-hermes.pathao.com' },
    { provider: 'REDX', isEnabled: true, isDefault: false, baseUrl: 'https://openapi.redx.com.bd/v1.0.0-beta' },
  ];

  for (const c of couriers) {
    await prisma.courierConfig.upsert({
      where: { provider: c.provider },
      update: {},
      create: c,
    });
  }

  // 4. Financial Accounts
  const accounts = [
    { name: 'Cash Counter (Main)', type: 'CASH', balance: 45000.0, isDefault: true },
    { name: 'bKash Merchant (01711xxxxxx)', type: 'BKASH_MERCHANT', accountNumber: '01711000000', balance: 125000.0 },
    { name: 'Nagad Merchant (01811xxxxxx)', type: 'NAGAD_MERCHANT', accountNumber: '01811000000', balance: 68000.0 },
    { name: 'City Bank Corporate A/C', type: 'BANK', bankName: 'The City Bank Ltd', accountNumber: '1102938481001', balance: 350000.0 },
  ];

  for (const acc of accounts) {
    const existing = await prisma.account.findFirst({ where: { name: acc.name } });
    if (!existing) {
      await prisma.account.create({ data: acc });
    }
  }

  // 5. Expense Categories
  const categories = [
    { name: 'Digital Advertising (FB/Google)', description: 'Facebook & Google Ads Spend', isFixed: false },
    { name: 'Office Rent & Utilities', description: 'Monthly rent, electricity, internet', isFixed: true },
    { name: 'Employee Salaries', description: 'Call center & warehouse staff', isFixed: true },
    { name: 'Packaging & Poly Bags', description: 'Boxes, bubble wrap, flyers, tape', isFixed: false },
    { name: 'Server & Tech Subscriptions', description: 'Hosting, domain, SMS API credits', isFixed: false },
  ];

  for (const cat of categories) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // 6. Suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'Rahman Garments & Textiles',
      company: 'Rahman Apparels Ltd',
      phone: '01712345678',
      email: 'rahman@textilebd.com',
      address: 'Mirpur-1, Dhaka',
      totalPurchased: 450000,
      totalPaid: 400000,
      balanceDue: 50000,
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: 'Smart Gadget Wholesale Ltd',
      company: 'Smart Electronics China BD',
      phone: '01812345678',
      email: 'sales@smartgadgets.com',
      address: 'Elephant Road, Dhaka',
      totalPurchased: 320000,
      totalPaid: 320000,
      balanceDue: 0,
    },
  });

  // 7. Products
  const products = [
    {
      name: 'Premium Oxford Cotton Formal Shirt',
      sku: 'SHIRT-OXF-01',
      barcode: '880123456701',
      category: 'Men Fashion',
      buyPrice: 520.0,
      regularPrice: 1250.0,
      salePrice: 990.0,
      stockQuantity: 145,
      minStockThreshold: 15,
      image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&auto=format&fit=crop&q=80',
    },
    {
      name: 'Active Noise Cancelling Wireless Earbuds TWS',
      sku: 'EARBUD-TWS-PRO',
      barcode: '880123456702',
      category: 'Electronics',
      buyPrice: 650.0,
      regularPrice: 1850.0,
      salePrice: 1390.0,
      stockQuantity: 80,
      minStockThreshold: 10,
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80',
    },
    {
      name: 'Genuine Leather Slim Bifold Wallet',
      sku: 'WALLET-LEA-BLK',
      barcode: '880123456703',
      category: 'Accessories',
      buyPrice: 280.0,
      regularPrice: 850.0,
      salePrice: 690.0,
      stockQuantity: 95,
      minStockThreshold: 10,
      image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&auto=format&fit=crop&q=80',
    },
    {
      name: 'Smart Fitness Tracker Watch with Heart Monitor',
      sku: 'SMARTWATCH-FT-09',
      barcode: '880123456704',
      category: 'Electronics',
      buyPrice: 850.0,
      regularPrice: 2200.0,
      salePrice: 1750.0,
      stockQuantity: 8, // Low Stock Trigger
      minStockThreshold: 12,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80',
    },
    {
      name: 'Casual Breathable Running Sneakers',
      sku: 'SHOE-SNEAK-42',
      barcode: '880123456705',
      category: 'Footwear',
      buyPrice: 950.0,
      regularPrice: 2600.0,
      salePrice: 2190.0,
      stockQuantity: 42,
      minStockThreshold: 10,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=80',
    },
  ];

  const createdProducts = [];
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
    createdProducts.push(prod);
  }

  // 8. Message Templates
  const templates = [
    {
      name: 'Order Confirmation SMS/WhatsApp',
      eventTrigger: 'ORDER_PLACED',
      channel: 'WHATSAPP',
      body: 'Hello {customer_name}! Thank you for placing Order #{order_number} with NIX Store. Your total amount is {grand_total} BDT (COD: {cod_amount} BDT). Our customer support team will contact you shortly to confirm.',
    },
    {
      name: 'Order Dispatched with Live Tracking',
      eventTrigger: 'DISPATCHED_TRACKING',
      channel: 'WHATSAPP',
      body: 'Dear {customer_name}, great news! Your order #{order_number} has been dispatched via {courier_name}. Tracking ID: {tracking_code}. Track your parcel live here: {tracking_url}',
    },
    {
      name: 'Delivered Thank You Note',
      eventTrigger: 'DELIVERED_THANK_YOU',
      channel: 'WHATSAPP',
      body: 'Dear {customer_name}, your parcel #{order_number} has been successfully delivered. Thank you for shopping with us! Please let us know your valuable feedback.',
    },
  ];

  for (const t of templates) {
    const existing = await prisma.messageTemplate.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.messageTemplate.create({ data: t });
    }
  }

  // 9. Customers & Realistic Orders
  const sampleCustomers = [
    {
      name: 'Mahmudul Hasan',
      phone: '01712998877',
      address: 'House 42, Road 9/A, Dhanmondi',
      district: 'Dhaka',
      city: 'Dhaka',
      totalOrders: 6,
      completedOrders: 5,
      cancelledOrders: 1,
      totalSpent: 8450,
      tags: JSON.stringify(['VIP', 'REGULAR']),
    },
    {
      name: 'Sadia Jahan Ritu',
      phone: '01819887766',
      address: 'Flat 4B, Concord Tower, GEC Circle',
      district: 'Chittagong',
      city: 'Chittagong',
      totalOrders: 3,
      completedOrders: 3,
      totalSpent: 4950,
      tags: JSON.stringify(['REGULAR']),
    },
    {
      name: 'Rakib Chowdhury',
      phone: '01912334455',
      address: 'Sector 4, Road 12, House 15, Uttara',
      district: 'Dhaka',
      city: 'Dhaka',
      totalOrders: 4,
      returnedOrders: 2,
      riskScore: 75,
      isBlacklisted: false,
      tags: JSON.stringify(['HIGH_RETURN_RISK']),
      notes: 'Customer refused previous 2 courier deliveries citing late arrival.',
    },
    {
      name: 'Ariful Islam',
      phone: '01611223344',
      address: 'Zindabazar, Main Road',
      district: 'Sylhet',
      city: 'Sylhet',
      totalOrders: 2,
      completedOrders: 2,
      totalSpent: 3500,
    },
    {
      name: 'Farzana Sharmin',
      phone: '01733445566',
      address: 'Shaheb Bazar, Boalia',
      district: 'Rajshahi',
      city: 'Rajshahi',
      totalOrders: 1,
      completedOrders: 1,
      totalSpent: 1390,
    },
  ];

  const createdCustomers = [];
  for (const c of sampleCustomers) {
    const cust = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: c,
    });
    createdCustomers.push(cust);
  }

  // 10. Sample Orders across pipeline
  const sampleOrders = [
    {
      orderNumber: 'NX-89201',
      customer: createdCustomers[0],
      product: createdProducts[0],
      qty: 2,
      status: 'PENDING',
      deliveryCharge: 60,
      paymentMethod: 'COD',
      assignedToId: agent.id,
      internalNote: 'Customer asked for quick delivery before Friday.',
    },
    {
      orderNumber: 'NX-89202',
      customer: createdCustomers[1],
      product: createdProducts[1],
      qty: 1,
      status: 'CONFIRMED',
      deliveryCharge: 120,
      paymentMethod: 'COD',
      assignedToId: agent.id,
    },
    {
      orderNumber: 'NX-89203',
      customer: createdCustomers[2],
      product: createdProducts[3],
      qty: 1,
      status: 'PENDING',
      deliveryCharge: 60,
      paymentMethod: 'COD',
      isFraudSuspect: true,
      internalNote: '⚠️ Flagged by Fraud System: Customer had 2 previous returns.',
    },
    {
      orderNumber: 'NX-89190',
      customer: createdCustomers[3],
      product: createdProducts[2],
      qty: 1,
      status: 'IN_TRANSIT',
      courierName: 'STEADFAST',
      courierTrackingCode: 'SF9823412',
      courierConsignmentId: 'CID82341',
      courierStatus: 'IN_TRANSIT',
      courierCharge: 80,
      deliveryCharge: 120,
      paymentMethod: 'COD',
    },
    {
      orderNumber: 'NX-89185',
      customer: createdCustomers[4],
      product: createdProducts[1],
      qty: 1,
      status: 'IN_TRANSIT',
      courierName: 'PATHAO',
      courierTrackingCode: 'PTH991283',
      courierConsignmentId: 'PTH991283',
      courierStatus: 'IN_TRANSIT',
      courierCharge: 95,
      deliveryCharge: 120,
      paymentMethod: 'COD',
    },
    {
      orderNumber: 'NX-89150',
      customer: createdCustomers[0],
      product: createdProducts[4],
      qty: 1,
      status: 'DELIVERED',
      courierName: 'STEADFAST',
      courierTrackingCode: 'SF7712399',
      courierConsignmentId: 'CID77123',
      courierStatus: 'DELIVERED',
      courierCharge: 60,
      courierCodReceived: 2250,
      courierSettlementStatus: 'RECONCILED',
      deliveryCharge: 60,
      paymentMethod: 'COD',
      paymentStatus: 'PAID',
    },
    {
      orderNumber: 'NX-89140',
      customer: createdCustomers[2],
      product: createdProducts[0],
      qty: 1,
      status: 'RETURNED',
      courierName: 'REDX',
      courierTrackingCode: 'REDX-331294',
      courierConsignmentId: 'REDX-331294',
      courierStatus: 'RETURNED',
      courierCharge: 80,
      courierReturnCharge: 40,
      deliveryCharge: 60,
      paymentMethod: 'COD',
    },
  ];

  for (const so of sampleOrders) {
    const subtotal = so.product.salePrice * so.qty;
    const cogsCost = so.product.buyPrice * so.qty;
    const grandTotal = subtotal + so.deliveryCharge;

    await prisma.order.upsert({
      where: { orderNumber: so.orderNumber },
      update: {},
      create: {
        orderNumber: so.orderNumber,
        customerId: so.customer.id,
        customerName: so.customer.name,
        customerPhone: so.customer.phone,
        customerAddress: so.customer.address || '',
        district: so.customer.district || 'Dhaka',
        city: so.customer.city || 'Dhaka',
        status: so.status,
        paymentMethod: so.paymentMethod,
        paymentStatus: so.paymentStatus || 'PENDING',
        subtotal,
        deliveryCharge: so.deliveryCharge,
        grandTotal,
        codAmount: grandTotal,
        cogsCost,
        courierName: so.courierName,
        courierTrackingCode: so.courierTrackingCode,
        courierConsignmentId: so.courierConsignmentId,
        courierStatus: so.courierStatus,
        courierCharge: so.courierCharge || 0,
        courierReturnCharge: so.courierReturnCharge || 0,
        courierCodReceived: so.courierCodReceived || 0,
        courierSettlementStatus: so.courierSettlementStatus || 'PENDING',
        isFraudSuspect: so.isFraudSuspect || false,
        internalNote: so.internalNote,
        assignedToId: so.assignedToId,
        items: {
          create: [
            {
              productId: so.product.id,
              productName: so.product.name,
              productSku: so.product.sku,
              quantity: so.qty,
              unitPrice: so.product.salePrice,
              unitBuyPrice: so.product.buyPrice,
              totalPrice: subtotal,
              totalBuyPrice: cogsCost,
            },
          ],
        },
      },
    });
  }

  // 11. Sample Ad Costs & Operating Expenses
  const adCostsSample = [
    {
      platform: 'FACEBOOK',
      campaignName: 'Oxford Shirt Conversions - May Promo',
      amount: 45.0,
      currency: 'USD',
      exchangeRate: 122.0,
      bdtAmount: 5490.0,
      impressions: 48500,
      clicks: 1420,
      ordersGenerated: 18,
      cpa: 305.0,
    },
    {
      platform: 'GOOGLE',
      campaignName: 'Smart Earbuds & Electronics Search Ads',
      amount: 30.0,
      currency: 'USD',
      exchangeRate: 122.0,
      bdtAmount: 3660.0,
      impressions: 12000,
      clicks: 890,
      ordersGenerated: 9,
      cpa: 406.0,
    },
  ];

  for (const ad of adCostsSample) {
    const existing = await prisma.adCost.findFirst({ where: { campaignName: ad.campaignName } });
    if (!existing) {
      await prisma.adCost.create({ data: ad });
    }
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
