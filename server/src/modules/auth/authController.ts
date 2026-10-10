import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma';
import { config } from '../../config';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';
import { z } from 'zod';
import { builderPermissions, readPermissionOverrides } from '../builder/permissions';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});
const passwordSchema = z.string().min(10).max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/\d/, 'Password must include a number');
const allowedRoles = new Set(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT', 'INVENTORY_MANAGER', 'DISPATCHER', 'ACCOUNTANT']);
const allowedStatuses = new Set(['ACTIVE', 'SUSPENDED', 'INACTIVE']);

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Enter a valid email and password' });
      return;
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, message: 'Your account is suspended or inactive' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionVersion: user.sessionVersion,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    res.cookie(config.cookieName, token, {
      httpOnly: true,
      secure: !config.isDev,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        is2FAEnabled: user.is2FAEnabled,
        builderAccess: builderPermissions(user.role, readPermissionOverrides(user.permissions)).access,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie(config.cookieName, { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: '/' });
  res.json({ success: true, message: 'Signed out' });
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ success: false, message: 'Current and new passwords are required' });
      return;
    }
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      res.status(400).json({ success: false, message: passwordResult.error.issues[0]?.message || 'Use a stronger password' });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ success: false, message: 'New password must be different' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } },
    });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: 'PASSWORD_CHANGE',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.clearCookie(config.cookieName, { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: '/' });
    res.json({ success: true, message: 'Password changed. Sign in again.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        avatar: true,
        is2FAEnabled: true,
        createdAt: true,
        permissions: true,
      },
    });

    if (!user) { res.status(401).json({ success: false }); return; }
    const { permissions, ...profile } = user;
    res.json({ success: true, user: { ...profile, builderAccess: builderPermissions(user.role, readPermissionOverrides(permissions)).access } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        is2FAEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, role } = req.body;

    const userDetails = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160), phone: z.string().trim().max(30).optional().nullable() }).safeParse({ name, email, phone });
    if (!userDetails.success || !password) {
      res.status(400).json({ success: false, message: 'Name, email, and password are required' });
      return;
    }
    if (role && !allowedRoles.has(role)) {
      res.status(400).json({ success: false, message: 'Invalid user role' });
      return;
    }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      res.status(400).json({ success: false, message: passwordResult.error.issues[0]?.message || 'Use a stronger password' });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'User with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: {
        name: userDetails.data.name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        phone: userDetails.data.phone,
        role: role || 'CALL_CENTER_AGENT',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'CREATE',
      entity: 'USER',
      entityId: newUser.id,
      details: { email: newUser.email, role: newUser.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.status(201).json({ success: true, message: 'User created successfully', user: newUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, phone, role, status, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { id }, select: { role: true, status: true } });
    if (!existingUser) { res.status(404).json({ success: false, message: 'Staff user not found' }); return; }

    const dataToUpdate: any = {};
    if (name !== undefined) {
      const parsedName = z.string().trim().min(2).max(80).safeParse(name);
      if (!parsedName.success) { res.status(400).json({ success: false, message: 'Enter a valid name' }); return; }
      dataToUpdate.name = parsedName.data;
    }
    if (phone !== undefined) {
      const parsedPhone = z.string().trim().max(30).nullable().safeParse(phone);
      if (!parsedPhone.success) { res.status(400).json({ success: false, message: 'Enter a valid phone number' }); return; }
      dataToUpdate.phone = parsedPhone.data;
    }
    if (role) {
      if (!allowedRoles.has(role)) { res.status(400).json({ success: false, message: 'Invalid user role' }); return; }
      dataToUpdate.role = role;
    }
    if (status) {
      if (!allowedStatuses.has(status)) { res.status(400).json({ success: false, message: 'Invalid user status' }); return; }
      dataToUpdate.status = status;
    }
    if (id === req.user!.id && (role && role !== existingUser.role || status && status !== existingUser.status)) {
      res.status(400).json({ success: false, message: 'You cannot change your own role or deactivate your account' });
      return;
    }
    if (existingUser.role === 'SUPER_ADMIN' && existingUser.status === 'ACTIVE' && (role && role !== 'SUPER_ADMIN' || status && status !== 'ACTIVE')) {
      const activeAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
      if (activeAdmins <= 1) { res.status(400).json({ success: false, message: 'At least one active super administrator is required' }); return; }
    }
    if (password) {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        res.status(400).json({ success: false, message: passwordResult.error.issues[0]?.message || 'Use a stronger password' });
        return;
      }
      dataToUpdate.password = await bcrypt.hash(password, 12);
      dataToUpdate.sessionVersion = { increment: 1 };
    }

    if ((role && role !== existingUser.role) || (status && status !== existingUser.status)) dataToUpdate.sessionVersion = { increment: 1 };
    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'UPDATE',
      entity: 'USER',
      entityId: id,
      details: { name, phoneChanged: phone !== undefined, role, status, passwordChanged: Boolean(password) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({ success: true, message: 'User updated successfully', user: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
