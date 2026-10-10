import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../prisma';
import { listCustomers, getCustomerProfile, updateCustomer } from '../modules/crm/crmController';
import { bulkUpdateStatus, updateOrderStatus } from '../modules/orders/orderController';
import { orderNotification } from '../modules/orders/orderNotification';
import { readSessionToken } from '../middlewares/auth';

const response = () => ({ code: 200, body: null as any, status(n: number) { this.code = n; return this; }, json(body: any) { this.body = body; return this; } });
const request = (body = {}) => ({ body, query: {}, params: { id: 'audit-order' }, headers: {} } as any);

test('CRM list, detail and update select no authentication fields', async () => {
  const delegate = prisma.customer as any;
  const originals = { findMany: delegate.findMany, findUnique: delegate.findUnique, update: delegate.update, count: delegate.count, audit: prisma.auditLog.create };
  const selections: any[] = [];
  delegate.findMany = async (args: any) => { selections.push(args.select); return []; };
  delegate.findUnique = async (args: any) => { selections.push(args.select); return { id: 'audit-customer', orders: [] }; };
  delegate.update = async (args: any) => { selections.push(args.select); return { id: 'audit-customer' }; };
  delegate.count = async () => 0;
  (prisma.auditLog as any).create = async () => ({});
  try {
    for (const handler of [listCustomers, getCustomerProfile, updateCustomer]) { const res = response(); await handler(request(), res as any); assert.equal(res.code, 200); }
    assert.equal(selections.length, 3);
    for (const select of selections) { assert.equal(select.id, true); assert.equal(select.password, undefined); assert.equal(select.sessionVersion, undefined); }
  } finally { Object.assign(delegate, { findMany: originals.findMany, findUnique: originals.findUnique, update: originals.update, count: originals.count }); (prisma.auditLog as any).create = originals.audit; }
});

test('notification strips nested customer secrets, costs and tracking metadata', () => {
  const data = { id: '1', orderNumber: 'NIX1', customerName: 'Test', grandTotal: 100, customer: { password: 'hash' }, checkoutDetails: 'ip', items: [{ buyPrice: 10 }] };
  assert.deepEqual(Object.keys(orderNotification(data)).sort(), ['customerName', 'grandTotal', 'id', 'orderNumber']);
});

test('malformed unrelated cookie cannot break session parsing', () => {
  assert.equal(readSessionToken({ headers: { cookie: 'broken=%E0%A4%A; nix_session=valid' } }), 'valid');
});

test('bulk updates reject every terminal source without mutating data', async () => {
  const original = prisma.order.findMany; const update = prisma.order.updateMany;
  let mutations = 0;
  (prisma.order as any).updateMany = async () => { mutations++; return { count: 1 }; };
  try {
    for (const status of ['DELIVERED', 'PARTIAL_DELIVERED', 'CANCELLED', 'RETURNED', 'FAKE_TRASH']) {
      (prisma.order as any).findMany = async () => [{ id: 'audit-order', status }];
      const res = response(); await bulkUpdateStatus(request({ orderIds: ['audit-order'], status: 'PENDING' }), res as any); assert.equal(res.code, 409);
    }
    assert.equal(mutations, 0);
  } finally { prisma.order.findMany = original; prisma.order.updateMany = update; }
});

test('delivered order cannot reopen and stale status change cannot restock', async () => {
  const original = prisma.order.findUnique; const transaction = prisma.$transaction;
  try {
    (prisma.order as any).findUnique = async () => ({ id: 'audit-order', status: 'DELIVERED', items: [] });
    let res = response(); await updateOrderStatus(request({ status: 'PENDING' }), res as any); assert.equal(res.code, 409);
    (prisma.order as any).findUnique = async () => ({ id: 'audit-order', status: 'PENDING', items: [{ productId: 'p', quantity: 1 }] });
    let restocks = 0;
    (prisma as any).$transaction = async (fn: any) => fn({ order: { updateMany: async () => ({ count: 0 }) }, product: { update: async () => { restocks++; } } });
    res = response(); await updateOrderStatus(request({ status: 'CANCELLED' }), res as any); assert.equal(res.code, 409); assert.equal(restocks, 0);
  } finally { prisma.order.findUnique = original; prisma.$transaction = transaction; }
});
import { landingDeliveryCharge } from '../modules/storefront/deliveryPolicy';
test('free delivery threshold preserves normal fees and applies only at valid quantity', () => {
  assert.equal(landingDeliveryCharge(150, 0, [{ quantity: 2 }]), 150);
  assert.equal(landingDeliveryCharge(150, 2, [{ quantity: 1 }]), 150);
  assert.equal(landingDeliveryCharge(150, 2, [{ quantity: 2 }]), 0);
  assert.equal(landingDeliveryCharge(70, 2, [{ quantity: 1 }, { quantity: 1 }]), 0);
  assert.equal(landingDeliveryCharge(70, -1, [{ quantity: 2 }]), 70);
});
