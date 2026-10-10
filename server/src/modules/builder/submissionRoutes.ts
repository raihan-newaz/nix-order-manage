import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { type AuthRequest } from '../../middlewares/auth';
import { requireBuilder } from './permissions';
import { csvCell } from './core/forms';
import { failure } from './service';

const router = Router();
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<void>) => (req: AuthRequest, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const statuses = z.enum(['NEW', 'REVIEWED', 'SPAM']);
router.get('/pages/:id/submissions', requireBuilder('submissions'), wrap(async (req, res) => {
  const pageId = z.string().uuid().parse(req.params.id);
  const query = z.object({ status: statuses.optional(), search: z.string().max(120).optional(), cursor: z.string().uuid().optional(), format: z.literal('csv').optional() }).parse(req.query);
  const records = await prisma.builderSubmission.findMany({ where: { pageId, status: query.status, ...(query.search ? { OR: [{ formName: { contains: query.search } }, { data: { contains: query.search } }] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.format === 'csv' ? 1000 : 101, ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}) });
  if (query.format === 'csv') {
    const rows = [['Submission ID', 'Form', 'Status', 'Received', 'Field', 'Value'].map(csvCell).join(',')];
    for (const record of records) for (const [field, value] of Object.entries(JSON.parse(record.data) as Record<string, string>)) rows.push([record.id, record.formName, record.status, record.createdAt.toISOString(), field, value].map(csvCell).join(','));
    res.setHeader('Content-Disposition', `attachment; filename="submissions-${pageId}.csv"`); res.type('text/csv').send(`\uFEFF${rows.join('\r\n')}`); return;
  }
  res.json({ submissions: records.slice(0, 100).map(({ data, ...record }) => ({ ...record, values: JSON.parse(data) })), nextCursor: records.length > 100 ? records[99].id : null });
}));
router.patch('/submissions/:id', requireBuilder('submissions'), wrap(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id); const body = z.object({ status: statuses, updatedAt: z.string().datetime() }).strict().parse(req.body);
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.builderSubmission.updateMany({ where: { id, updatedAt: new Date(body.updatedAt) }, data: { status: body.status } });
    if (!result.count) throw failure(409, 'This submission changed. Reload before updating.');
    await tx.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'UPDATE', entity: 'SETTING', entityId: id, details: JSON.stringify({ builderSubmissionStatus: body.status }) } });
    return tx.builderSubmission.findUniqueOrThrow({ where: { id }, select: { updatedAt: true, status: true } });
  }); res.json(updated);
}));
router.delete('/submissions/:id', requireBuilder('submissions'), wrap(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  await prisma.$transaction(async tx => {
    await tx.builderSubmission.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'DELETE', entity: 'SETTING', entityId: id, details: JSON.stringify({ entity: 'builder-submission' }) } });
  }); res.sendStatus(204);
}));
export default router;
