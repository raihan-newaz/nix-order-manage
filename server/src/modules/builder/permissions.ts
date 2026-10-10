import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middlewares/auth';
import prisma from '../../prisma';

export const capabilities = ['access', 'edit', 'publish', 'templates', 'submissions'] as const;
export type Capability = typeof capabilities[number];
export function readPermissionOverrides(value: string | null): Record<string, unknown> {
  try { const parsed: unknown = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}
export function builderPermissions(role: string, overrides: unknown = {}): Record<Capability, boolean> {
  const allowed = role === 'SUPER_ADMIN' || role === 'OPERATIONS_MANAGER';
  const record = overrides && typeof overrides === 'object' ? overrides as Record<string, unknown> : {};
  return Object.fromEntries(capabilities.map(key => [key, role === 'SUPER_ADMIN' ? true : typeof record[`builder.${key}`] === 'boolean' ? record[`builder.${key}`] : allowed])) as Record<Capability, boolean>;
}
export const requireBuilder = (capability: Capability) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) { res.status(401).json({ message: 'Sign in to use Studio' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { permissions: true, role: true } });
    if (!user) { res.sendStatus(401); return; }
    const overrides = readPermissionOverrides(user.permissions);
    const permissions = builderPermissions(user.role, overrides);
    if (!permissions.access || !permissions[capability]) { res.status(403).json({ message: 'You do not have permission for this builder action' }); return; }
    res.locals.builderPermissions = permissions; next();
  } catch (error) { next(error); }
};
