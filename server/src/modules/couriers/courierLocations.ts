import { Request, Response } from 'express';
import prisma from '../../prisma';
import { callPathao } from './pathaoSession';
import { getSteadfastAdapter } from './steadfastSession';
import { getRedXAdapter } from './redxSession';

type Level = 'DISTRICT' | 'THANA' | 'AREA';
type Location = { provider: string; level: Level; externalId: string; parentExternalId?: string; name: string; normalizedName: string; districtName?: string; active?: boolean };
export const normalizeLocation = (value: string) => value.toLowerCase().normalize('NFKC').replace(/\b(district|zila|zilla)\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

async function saveLocations(items: Location[]) {
  for (let i = 0; i < items.length; i += 25) {
    await Promise.all(items.slice(i, i + 25).map((item) => prisma.courierLocation.upsert({
      where: { provider_level_externalId: { provider: item.provider, level: item.level, externalId: item.externalId } },
      create: item,
      update: { parentExternalId: item.parentExternalId, name: item.name, normalizedName: item.normalizedName, districtName: item.districtName, active: item.active ?? true },
    })));
  }
  return items.length;
}

export async function syncSteadfastLocations() {
  const { adapter } = await getSteadfastAdapter();
  const result = await adapter.getPoliceStations();
  if (!result.success || !Array.isArray(result.data?.data)) throw new Error(!result.success ? result.message : 'Steadfast did not return districts and police stations');
  const items: Location[] = [];
  for (const district of result.data.data) {
    if (!district.id || !district.name) continue;
    const districtId = String(district.id);
    const districtName = String(district.name).trim();
    items.push({ provider: 'STEADFAST', level: 'DISTRICT', externalId: districtId, name: districtName, normalizedName: normalizeLocation(districtName), active: true });
    for (const station of district.policestations || []) {
      if (!station.id || !station.name || Number(station.status) === 0 || /^(test\b|null$|nul$)/i.test(String(station.name).trim())) continue;
      const name = String(station.name).trim();
      items.push({ provider: 'STEADFAST', level: 'THANA', externalId: String(station.id), parentExternalId: districtId, name, normalizedName: normalizeLocation(name), districtName, active: true });
    }
  }
  await prisma.courierLocation.updateMany({ where: { provider: 'STEADFAST' }, data: { active: false } });
  const count = await saveLocations(items);
  await prisma.courierLocationSync.upsert({ where: { provider_level_parentKey: { provider: 'STEADFAST', level: 'DISTRICT', parentKey: '' } }, create: { provider: 'STEADFAST', level: 'DISTRICT', parentKey: '', itemCount: count }, update: { itemCount: count, syncedAt: new Date() } });
  return count;
}

export async function syncPathaoLocations(level: Level, parentId?: string) {
  if (level !== 'DISTRICT' && (!parentId || !/^\d+$/.test(parentId))) throw new Error('A Pathao parent location is required');
  const result = level === 'DISTRICT' ? await callPathao((adapter, token) => adapter.getCities(token)) :
    level === 'THANA' ? await callPathao((adapter, token) => adapter.getZones(Number(parentId), token)) :
      await callPathao((adapter, token) => adapter.getAreas(Number(parentId), token));
  if (!result.success || !Array.isArray(result.data)) throw new Error(`${!result.success ? result.message : 'Pathao location lookup failed'}${!result.success && result.status ? ` (HTTP ${result.status})` : ''}`);
  const idKey = level === 'DISTRICT' ? 'city_id' : level === 'THANA' ? 'zone_id' : 'area_id';
  const nameKey = level === 'DISTRICT' ? 'city_name' : level === 'THANA' ? 'zone_name' : 'area_name';
  const items = result.data.filter((entry: any) => entry[idKey] && entry[nameKey]).map((entry: any) => {
    const name = String(entry[nameKey]).trim();
    return { provider: 'PATHAO', level, externalId: String(entry[idKey]), parentExternalId: parentId, name, normalizedName: normalizeLocation(name), active: entry.home_delivery_available !== false };
  });
  await prisma.courierLocation.updateMany({ where: { provider: 'PATHAO', level, ...(level !== 'DISTRICT' ? { parentExternalId: parentId } : {}) }, data: { active: false } });
  const count = await saveLocations(items);
  await prisma.courierLocationSync.upsert({ where: { provider_level_parentKey: { provider: 'PATHAO', level, parentKey: parentId || '' } }, create: { provider: 'PATHAO', level, parentKey: parentId || '', itemCount: count }, update: { itemCount: count, syncedAt: new Date() } });
  return count;
}

export async function syncRedXAreas() {
  const { adapter } = await getRedXAdapter();
  const result = await adapter.getAreas();
  if (!result.success) throw new Error(result.message || 'RedX areas are unavailable');
  const items: Location[] = result.data.filter(area => Number.isInteger(area.id) && area.id > 0 && area.name).map(area => ({
    provider: 'REDX', level: 'AREA', externalId: String(area.id), name: String(area.name).trim(),
    normalizedName: normalizeLocation(String(area.name)), districtName: String(area.division_name || '').trim() || undefined,
    active: true,
  }));
  await prisma.courierLocation.updateMany({ where: { provider: 'REDX', level: 'AREA' }, data: { active: false } });
  const count = await saveLocations(items);
  await prisma.courierLocationSync.upsert({ where: { provider_level_parentKey: { provider: 'REDX', level: 'AREA', parentKey: '' } },
    create: { provider: 'REDX', level: 'AREA', parentKey: '', itemCount: count }, update: { itemCount: count, syncedAt: new Date() } });
  return count;
}

export const listCourierLocations = async (req: Request, res: Response): Promise<void> => {
  const provider = String(req.params.provider || '').toUpperCase();
  const level = String(req.query.level || '').toUpperCase() as Level;
  const parentId = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;
  if (!['STEADFAST', 'PATHAO', 'REDX'].includes(provider) || !['DISTRICT', 'THANA', 'AREA'].includes(level) || (provider === 'REDX' && level !== 'AREA') || (provider !== 'REDX' && level !== 'DISTRICT' && !parentId)) {
    res.status(400).json({ success: false, message: 'Choose a provider, location level and parent' }); return;
  }
  if (provider === 'STEADFAST' && level === 'AREA') { res.json({ success: true, locations: [] }); return; }
  try {
    const where = { provider, level, active: true, ...(level !== 'DISTRICT' && provider !== 'REDX' ? { parentExternalId: parentId } : {}) };
    let locations = await prisma.courierLocation.findMany({ where, orderBy: { name: 'asc' }, take: provider === 'REDX' ? 10000 : 2000 });
    const synced = await prisma.courierLocationSync.findUnique({ where: { provider_level_parentKey: { provider, level, parentKey: level === 'DISTRICT' || provider === 'REDX' ? '' : parentId || '' } } });
    if (!locations.length && !synced) {
      if (provider === 'STEADFAST') await syncSteadfastLocations();
      else if (provider === 'REDX') await syncRedXAreas();
      else await syncPathaoLocations(level, parentId);
      locations = await prisma.courierLocation.findMany({ where, orderBy: { name: 'asc' }, take: provider === 'REDX' ? 10000 : 2000 });
    }
    res.json({ success: true, locations });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const refreshCourierLocations = async (req: Request, res: Response): Promise<void> => {
  const provider = String(req.params.provider || '').toUpperCase();
  const level = String(req.body?.level || 'DISTRICT').toUpperCase() as Level;
  const parentId = req.body?.parentId ? String(req.body.parentId) : undefined;
  try {
    const count = provider === 'STEADFAST' ? await syncSteadfastLocations() : provider === 'REDX' && level === 'AREA' ? await syncRedXAreas() : provider === 'PATHAO' && ['DISTRICT', 'THANA', 'AREA'].includes(level) ? await syncPathaoLocations(level, parentId) : null;
    if (count === null) { res.status(400).json({ success: false, message: 'Unsupported location provider or level' }); return; }
    res.json({ success: true, count });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};
