import prisma from '../../prisma';
import { protectSecret, revealSecret } from '../../utils/security';
import { PathaoAdapter } from './adapters/pathao';

export const PATHAO_SANDBOX_URL = 'https://courier-api-sandbox.pathao.com';
export const PATHAO_LIVE_URL = 'https://api-hermes.pathao.com';
export const pathaoBaseUrl = (value?: string | null) => {
  const url = (value || PATHAO_LIVE_URL).replace(/\/+$/, '');
  if (url !== PATHAO_SANDBOX_URL && url !== PATHAO_LIVE_URL) throw new Error('Select the official Pathao sandbox or live API URL');
  return url;
};

export async function getPathaoSession(requireEnabled = false, forceRefresh = false) {
  const settings = await prisma.courierConfig.findUnique({ where: { provider: 'PATHAO' } });
  if (!settings?.clientId || !settings.clientSecret || !settings.username || !settings.password) {
    throw new Error('Set Pathao client ID, secret, merchant email, and password in Courier Settings');
  }
  if (requireEnabled && (!settings.isEnabled || !settings.storeId)) {
    throw new Error('Enable Pathao and select an approved pickup store in Courier Settings');
  }
  const adapter = new PathaoAdapter(settings.clientId, revealSecret(settings.clientSecret), pathaoBaseUrl(settings.baseUrl));
  if (!forceRefresh && settings.accessToken && settings.tokenExpiresAt && settings.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) {
    return { adapter, token: revealSecret(settings.accessToken), settings };
  }

  const refreshed = settings.refreshToken ? await adapter.refresh(revealSecret(settings.refreshToken)) : null;
  const issued = refreshed?.success && refreshed.token ? refreshed : await adapter.authenticate(settings.username, revealSecret(settings.password));
  if (!issued.success || !issued.token) throw new Error(issued.message || 'Could not authenticate with Pathao');

  const expiresIn = Number.isFinite(issued.expiresIn) && issued.expiresIn! > 0 ? Math.min(issued.expiresIn!, 432000) : 3600;
  await prisma.courierConfig.update({ where: { provider: 'PATHAO' }, data: {
    accessToken: protectSecret(issued.token),
    refreshToken: issued.refreshToken ? protectSecret(issued.refreshToken) : settings.refreshToken,
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
  } });
  return { adapter, token: issued.token, settings };
}

export async function callPathao<T extends { success: boolean; status?: number }>(operation: (adapter: PathaoAdapter, token: string) => Promise<T>, requireEnabled = false): Promise<T> {
  let session = await getPathaoSession(requireEnabled);
  let result = await operation(session.adapter, session.token);
  if (!result.success && result.status === 401) {
    session = await getPathaoSession(requireEnabled, true);
    result = await operation(session.adapter, session.token);
  }
  return result;
}
