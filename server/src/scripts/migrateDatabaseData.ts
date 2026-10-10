import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const migrationFile = path.resolve(__dirname, '../../prisma/.migration-data.json');
const models = [
  'User', 'WooCommerceStore', 'Customer', 'Warehouse', 'Category',
  'StorefrontSettings', 'MediaAsset', 'Product', 'ProductVariant',
  'Supplier', 'ExpenseCategory', 'CourierConfig', 'Account',
  'MessageGatewayConfig', 'MessageTemplate', 'PurchaseOrder', 'Order',
  'StockMovement', 'PurchaseOrderItem', 'OrderItem', 'Transaction',
  'Expense', 'AdCost', 'MessageLog', 'AuditLog',
] as const;

const delegateName = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

async function exportData() {
  const data: Record<string, unknown[]> = {};
  for (const model of models) {
    const delegate = (prisma as any)[delegateName(model)];
    data[model] = await delegate.findMany();
  }
  fs.writeFileSync(migrationFile, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  console.log(`Exported ${Object.values(data).reduce((sum, rows) => sum + rows.length, 0)} records.`);
}

async function importData() {
  if (!fs.existsSync(migrationFile)) throw new Error('Migration data file not found');
  const data = JSON.parse(fs.readFileSync(migrationFile, 'utf8')) as Record<string, Record<string, unknown>[]>;
  const definitions = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
  let imported = 0;
  for (const model of models) {
    const definition = definitions.get(model);
    const rows = data[model] || [];
    if (!definition || rows.length === 0) continue;
    const dateFields = new Set(definition.fields.filter((field) => field.type === 'DateTime').map((field) => field.name));
    const normalized = rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, dateFields.has(key) && value ? new Date(String(value)) : value]),
    ));
    const delegate = (prisma as any)[delegateName(model)];
    const result = await delegate.createMany({ data: normalized, skipDuplicates: true });
    imported += result.count;
  }
  fs.rmSync(migrationFile);
  console.log(`Imported ${imported} records and removed the temporary migration file.`);
}

const mode = process.argv[2];
(mode === 'export' ? exportData() : mode === 'import' ? importData() : Promise.reject(new Error('Use export or import')))
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
