import prisma from '../../prisma';
import { revealSecret } from '../../utils/security';
import { RedXAdapter, redxBaseUrl } from './adapters/redx';

export async function getRedXAdapter(requireEnabled = false) {
  const settings = await prisma.courierConfig.findUnique({ where: { provider: 'REDX' } });
  if (!settings?.apiKey || (requireEnabled && !settings.isEnabled)) throw new Error('Configure and enable RedX in Courier Settings');
  return { adapter: new RedXAdapter(revealSecret(settings.apiKey), redxBaseUrl(settings.baseUrl)), settings };
}
