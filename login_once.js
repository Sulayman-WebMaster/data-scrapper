const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  const cookiesPath = './cookies.json';

  // Load existing cookies if available
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    await page.setCookie(...cookies);
    console.log('✅ Loaded existing session cookies');
  }

  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });

  console.log('⏳ Please log in manually in the opened browser window.');
  console.log('⏱️ You have 5 minutes...');
  await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes

  const cookies = await page.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
  console.log('✅ Session saved to cookies.json');

  await browser.close();
})();
