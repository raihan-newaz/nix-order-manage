import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import prisma from '../prisma';

async function main() {
  const directory = path.resolve(__dirname, '../../prisma/builder-migrations');
  for (const filename of fs.readdirSync(directory).filter(name => /^\d+_[a-z_]+\.sql$/.test(name)).sort()) {
    const sql = fs.readFileSync(path.join(directory, filename), 'utf8');
    // Only repository-owned SQL is executed. Never accept uploaded migrations.
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
  }
  console.log('Builder tables installed. Existing application tables were not modified.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Migration failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
