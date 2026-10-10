import prisma from '../../prisma';

interface LogAuditParams {
  userId?: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'COURIER_SEND' | 'PAYMENT' | 'LOGIN' | 'PASSWORD_CHANGE' | 'EXPORT' | 'ASSIGNMENT' | 'PRIORITY_CHANGE';
  entity: 'ORDER' | 'PRODUCT' | 'INVENTORY' | 'PURCHASE' | 'EXPENSE' | 'AD_COST' | 'USER' | 'SETTING' | 'CUSTOMER';
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(params: LogAuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
