const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('fs');
require('dotenv').config();

const FB_EMAIL = process.env.FB_EMAIL;
const FB_PASSWORD = process.env.FB_PASSWORD;

const workbook = XLSX.readFile('facebook_pages.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const urls = XLSX.utils.sheet_to_json(sheet).map(row => row['Facebook Page']);

(async () => {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  // 🔐 LOGIN TO FACEBOOK
  console.log("Logging in to Facebook...");
  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
  await page.type('#email', FB_EMAIL, { delay: 50 });
  await page.type('#pass', FB_PASSWORD, { delay: 50 });
  await Promise.all([
    page.click('[name="login"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);
  console.log("✅ Logged in successfully");

  const results = [];

  for (const url of urls) {
    try {
      console.log(`Visiting: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);

      const aboutLink = await page.$x("//a[contains(., 'About') or contains(., 'Info')]");
      if (aboutLink.length > 0) {
        await aboutLink[0].click();
        await page.waitForTimeout(3000);
      }

      const content = await page.content();

      const extract = (pattern) => {
        const match = content.match(pattern);
        return match ? match[0] : '';
      };

      const email = extract(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
      const phone = extract(/(?:\+?\d{1,3})?[ -.]?\(?\d{2,4}\)?[ -.]?\d{3,4}[ -.]?\d{4}/);
      const website = extract(/https?:\/\/[^\s"']+/);
      const title = await page.title();

      results.push({
        'Page URL': url,
        'Page Name': title,
        'Email': email,
        'Phone': phone,
        'Website': website,
      });

    } catch (err) {
      console.error(`❌ Error on ${url}: ${err}`);
      results.push({
        'Page URL': url,
        'Page Name': '',
        'Email': '',
        'Phone': '',
        'Website': ''
      });
    }
  }

  await browser.close();

  const outputSheet = XLSX.utils.json_to_sheet(results);
  const outputBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outputBook, outputSheet, 'Results');
  XLSX.writeFile(outputBook, 'facebook_page_results.xlsx');

  console.log('✅ Done. Results saved to facebook_page_results.xlsx');
})();
