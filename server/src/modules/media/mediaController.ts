import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import prisma from '../../prisma';

const isRealImage = (filePath: string, mimeType: string) => {
  const bytes = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try { fs.readSync(fd, bytes, 0, bytes.length, 0); } finally { fs.closeSync(fd); }
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
};

export const listMedia = async (_req: Request, res: Response): Promise<void> => {
  try {
    const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    res.json({ success: true, assets });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'Choose an image to upload' }); return; }
    if (!isRealImage(req.file.path, req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ success: false, message: 'The uploaded file is not a valid supported image' });
      return;
    }
    const asset = await prisma.mediaAsset.create({
      data: { fileName: req.file.originalname, url: `/uploads/media/${req.file.filename}`, altText: String(req.body.altText || '').trim() || null, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ success: true, asset });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const updateMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const asset = await prisma.mediaAsset.update({ where: { id: String(req.params.id) }, data: { altText: String(req.body.altText || '').trim() || null } });
    res.json({ success: true, asset });
  } catch (error: any) { res.status(404).json({ success: false, message: 'Media asset not found' }); }
};

export const deleteMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const asset = await prisma.mediaAsset.delete({ where: { id: String(req.params.id) } });
    const target = path.resolve(__dirname, '../../../uploads/media', path.basename(asset.url));
    if (fs.existsSync(target)) fs.unlinkSync(target);
    res.json({ success: true });
  } catch (error: any) { res.status(404).json({ success: false, message: 'Media asset not found' }); }
};
