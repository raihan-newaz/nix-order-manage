import fs from 'fs';
import path from 'path';
import prisma from '../prisma';

const getMimeType = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
};

async function syncMediaAssets() {
  const mediaDir = path.resolve(__dirname, '../../../uploads/media');
  if (!fs.existsSync(mediaDir)) {
    console.log(`Media directory not found at: ${mediaDir}`);
    return;
  }

  const files = fs.readdirSync(mediaDir);
  console.log(`Found ${files.length} files in media directory.`);

  let createdCount = 0;
  for (const fileName of files) {
    const fullPath = path.join(mediaDir, fileName);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const url = `/uploads/media/${fileName}`;
    const altText = path.parse(fileName).name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const mimeType = getMimeType(fileName);

    const existing = await prisma.mediaAsset.findUnique({
      where: { url },
    });

    if (!existing) {
      await prisma.mediaAsset.create({
        data: {
          fileName,
          url,
          altText,
          mimeType,
          size: stat.size,
        },
      });
      createdCount++;
    }
  }

  console.log(`Sync complete. Added ${createdCount} new media assets.`);
}

syncMediaAssets()
  .catch((err) => {
    console.error('Failed to sync media assets:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
