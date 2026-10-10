import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../../middlewares/auth';
import { deleteMedia, listMedia, updateMedia, uploadMedia } from './mediaController';

const mediaDirectory = path.resolve(__dirname, '../../../uploads/media');
fs.mkdirSync(mediaDirectory, { recursive: true });
const storage = multer.diskStorage({
  destination: mediaDirectory,
  filename: (_req, file, callback) => {
    const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extensions[file.mimetype] || '.bin'}`);
  },
});
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, allowedTypes.has(file.mimetype)) });
const router = Router();

router.use(authenticateToken);
router.get('/', listMedia);
router.post('/upload', requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), upload.single('file'), uploadMedia);
router.patch('/:id', requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), updateMedia);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), deleteMedia);

export default router;
