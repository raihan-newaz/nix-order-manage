const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const allImages = new Set();
  for (let page = 1; page <= 4; page++) {
    const url = page === 1 ? 'https://arabic.net.bd/shop/' : `https://arabic.net.bd/shop/page/${page}/`;
    const html = await fetchUrl(url);
    const regex = /https:\/\/arabic\.net\.bd\/wp-content\/uploads\/[^\s"'<>]+\.(?:jpg|jpeg|png)/gi;
    const matches = html.match(regex) || [];
    for (const m of matches) {
      // Keep only full resolution images (skip thumbnails like -150x..., -430x..., etc.)
      if (!/-\d+x\d+\.(?:jpg|jpeg|png)$/i.test(m) && !m.includes('logo') && !m.includes('favicon')) {
        allImages.add(m);
      }
    }
  }
  console.log(`Found ${allImages.size} full-size product images:`);
  console.log(JSON.stringify(Array.from(allImages), null, 2));
}

run();
