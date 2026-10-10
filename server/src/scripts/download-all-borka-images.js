const https = require('https');
const fs = require('fs');
const path = require('path');

const mediaDir = path.resolve(__dirname, '../../uploads/media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const getWithRedirect = (currentUrl) => {
      https.get(currentUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, response => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          getWithRedirect(response.headers.location);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Status ${response.statusCode} for ${currentUrl}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            const stats = fs.statSync(dest);
            resolve(stats.size);
          });
        });
      }).on('error', err => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    getWithRedirect(url);
  });
}

const imagesToDownload = [
  // Kaftan
  { file: 'borka-kaftan-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788962344394-woo-0-2.jpg' },
  { file: 'borka-kaftan-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788962470934-woo-0-1.jpg' },
  { file: 'borka-kaftan-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788962564903-woo-0.jpg' },
  { file: 'borka-kaftan-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788962664531-woo-0.jpg' },

  // Butterfly
  { file: 'borka-butterfly-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/07/IMG_20260629_175152.jpg' },
  { file: 'borka-butterfly-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/07/IMG_20260630_171828.jpg' },
  { file: 'borka-butterfly-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/07/InShot_20260629_173400580-1.jpg' },
  { file: 'borka-butterfly-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/07/IMG_20260630_181228-1.jpg' },

  // Kashmiri
  { file: 'borka-kashmiri-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788888846300-woo-0-22.jpg' },
  { file: 'borka-kashmiri-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788899206850-woo-0-4.jpg' },
  { file: 'borka-kashmiri-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788888297537-woo-0-10.jpg' },
  { file: 'borka-kashmiri-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788963704117-woo-0.jpg' },

  // Coat
  { file: 'borka-coat-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2025/12/1763282543467-2-19.jpg' },
  { file: 'borka-coat-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2025/12/pHOaM6qoqYrBb0JA3fCL1gryK4TaUR5DjZO4R7iH-1.jpg' },
  { file: 'borka-coat-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2025/12/9Gsf7sFHhC9BVcg6VOPdMJHKK4ZQkYG4CAwMPuk9-1-1.jpg' },
  { file: 'borka-coat-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2025/12/IMG_20251206_020515.jpg' },

  // Koti
  { file: 'borka-koti-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/485485109_992945639085929_4488780102671746157_n.jpg' },
  { file: 'borka-koti-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/485630312_985713397033037_1821449277060876130_n-1.jpg' },
  { file: 'borka-koti-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/484585332_646273958014186_5223357063126669057_n-1.jpg' },
  { file: 'borka-koti-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/483828968_1794710451424217_2476687338867593968_n-1.jpg' },

  // Kimono
  { file: 'borka-kimono-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/483848998_1064483545579827_6795196267111427351_n.jpg' },
  { file: 'borka-kimono-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/485015681_1801469564039360_7635884482846159922_n.jpg' },
  { file: 'borka-kimono-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2025/04/WhatsApp-Image-2025-04-16-at-23.11.44_922a2522.jpg' },
  { file: 'borka-kimono-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2025/04/WhatsApp-Image-2025-04-16-at-23.11.45_8406f2ac.jpg' },

  // Linen
  { file: 'borka-linen-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/brown.jpg' },
  { file: 'borka-linen-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/brown-1.jpg' },
  { file: 'borka-linen-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/Cream.jpg' },
  { file: 'borka-linen-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/White.jpg' },

  // Velvet
  { file: 'borka-velvet-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/Black.jpg' },
  { file: 'borka-velvet-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/Black-1.jpg' },
  { file: 'borka-velvet-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/Black-2.jpg' },
  { file: 'borka-velvet-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/N-blue-1.jpg' },

  // Nawab Set
  { file: 'borka-nawab-1.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/N-blue.jpg' },
  { file: 'borka-nawab-2.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/N-blue-2.jpg' },
  { file: 'borka-nawab-3.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/White-1-1.jpg' },
  { file: 'borka-nawab-4.jpg', url: 'https://arabic.net.bd/wp-content/uploads/2024/03/White-2.jpg' }
];

async function main() {
  console.log(`Starting download of ${imagesToDownload.length} authentic borka images...`);
  for (const item of imagesToDownload) {
    const dest = path.join(mediaDir, item.file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`Exists: ${item.file} (${fs.statSync(dest).size} bytes)`);
      continue;
    }
    try {
      const size = await downloadFile(item.url, dest);
      console.log(`Downloaded: ${item.file} (${size} bytes)`);
    } catch (err) {
      console.error(`Failed ${item.file}:`, err.message);
    }
  }
  console.log('Finished downloading borka images!');
}

main();
