import prisma from '../../prisma';
import { revealSecret } from '../../utils/security';
import { SteadfastAdapter } from './adapters/steadfast';

export async function getSteadfastAdapter(requireEnabled = false) {
  const settings = await prisma.courierConfig.findUnique({ where: { provider: 'STEADFAST' } });
  if (!settings?.apiKey || !settings.secretKey) throw new Error('Set Steadfast API Key and Secret Key in Courier Settings');
  if (requireEnabled && !settings.isEnabled) throw new Error('Enable Steadfast in Courier Settings');
  return { adapter: new SteadfastAdapter(revealSecret(settings.apiKey), revealSecret(settings.secretKey)), settings };
}
