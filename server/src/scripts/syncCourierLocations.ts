import prisma from '../prisma';
import { syncPathaoLocations, syncSteadfastLocations } from '../modules/couriers/courierLocations';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function markExistingCache() {
  for (const level of ['THANA', 'AREA'] as const) {
    const groups = await prisma.courierLocation.groupBy({ where: { provider: 'PATHAO', level }, by: ['parentExternalId'], _count: { _all: true } });
    await prisma.courierLocationSync.createMany({ data: groups.filter(item => item.parentExternalId).map(item => ({ provider: 'PATHAO', level, parentKey: item.parentExternalId!, itemCount: item._count._all })), skipDuplicates: true });
  }
  const districts = await prisma.courierLocation.count({ where: { provider: 'PATHAO', level: 'DISTRICT' } });
  if (districts) await prisma.courierLocationSync.upsert({ where: { provider_level_parentKey: { provider: 'PATHAO', level: 'DISTRICT', parentKey: '' } }, create: { provider: 'PATHAO', level: 'DISTRICT', parentKey: '', itemCount: districts }, update: {} });
}

async function syncMissing(level: 'THANA' | 'AREA', parentLevel: 'DISTRICT' | 'THANA') {
  const parents = await prisma.courierLocation.findMany({ where: { provider: 'PATHAO', level: parentLevel, active: true }, select: { externalId: true } });
  const cached = await prisma.courierLocationSync.findMany({ where: { provider: 'PATHAO', level }, select: { parentKey: true } });
  const cachedParents = new Set(cached.map((item) => item.parentKey));
  const missing = parents.filter((parent) => !cachedParents.has(parent.externalId));
  let completed = parents.length - missing.length;
  let cursor = 0;
  let rateLimited = false;
  const errors: string[] = [];
  const runWorker = async () => {
    while (cursor < missing.length && !rateLimited) {
      const parent = missing[cursor++];
      try { await syncPathaoLocations(level, parent.externalId); }
      catch (error: any) {
        if (/\b429\b|Too Many Requests|rate.?limit/i.test(error.message)) {
          rateLimited = true;
          errors.push(`${level} sync paused at parent ${parent.externalId} after courier rate limit`);
          break;
        }
        await sleep(15_000);
        try { await syncPathaoLocations(level, parent.externalId); }
        catch (retryError: any) { errors.push(`${level} parent ${parent.externalId}: ${retryError.message}`); completed++; continue; }
      }
      completed++;
      if (completed % 10 === 0 || completed === parents.length) console.log(`${level}: ${completed}/${parents.length} parents; ${errors.length} issues`);
      await sleep(level === 'AREA' ? 3200 : 1000);
    }
  };
  await runWorker();
  return errors;
}

async function main() {
  await markExistingCache();
  const steadfast = await syncSteadfastLocations();
  console.log(`Steadfast refreshed: ${steadfast} district/thana records`);
  const cities = await prisma.courierLocation.count({ where: { provider: 'PATHAO', level: 'DISTRICT' } });
  if (!cities) { await syncPathaoLocations('DISTRICT'); console.log('Pathao cities loaded'); }
  const zoneErrors = await syncMissing('THANA', 'DISTRICT');
  const areaErrors = await syncMissing('AREA', 'THANA');
  const counts = await prisma.courierLocation.groupBy({ by: ['provider', 'level'], _count: { _all: true } });
  console.log(JSON.stringify({ counts: counts.map(item => ({ provider: item.provider, level: item.level, count: item._count._all })), errors: [...zoneErrors, ...areaErrors] }));
  if (zoneErrors.length || areaErrors.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
