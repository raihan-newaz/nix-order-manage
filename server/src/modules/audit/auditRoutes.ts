import { Router, Request, Response } from 'express';
import prisma from '../../prisma';
import { authenticateToken, requireRole } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', entity, action } = req.query;
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);

    const where: any = {};
    if (entity) where.entity = entity as string;
    if (action) where.action = action as string;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
