const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('fs');

const inputFile = 'facebook_pages.xlsx';
const outputFile = 'facebook_page_results.xlsx';
const cookiesPath = './cookies.json';

// Load Facebook page URLs
const workbook = XLSX.readFile(inputFile);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const urls = XLSX.utils.sheet_to_json(sheet).map(row => row['Facebook Page']);

// Load previous results if file exists
let results = [];
if (fs.existsSync(outputFile)) {
  const existing = XLSX.readFile(outputFile);
  const existingSheet = existing.Sheets[existing.SheetNames[0]];
  results = XLSX.utils.sheet_to_json(existingSheet);
  console.log(`🔄 Loaded ${results.length} existing rows from Excel`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  // Load cookies
  if (fs.existsSync(cookiesPath)) {
    const rawCookies = JSON.parse(fs.readFileSync(cookiesPath));
    const cookies = rawCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false
    }));
    await page.setCookie(...cookies);
    console.log('✅ Cookies loaded');
  } else {
    console.log('❌ Missing cookies.json');
    await browser.close();
    return;
  }

  for (let rowIndex = 0; rowIndex < urls.length; rowIndex++) {
    const url = urls[rowIndex];

    if (results.find(r => r['Page URL'] === url)) {
      console.log(`⏭ Skipping already saved: ${url}`);
      continue;
    }

    try {
      console.log(`🌐 Visiting: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      const aboutLink = await page.$("a[href*='about'], a[href*='info']");
      if (aboutLink) {
        await aboutLink.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const title = await page.title();

      // Regex from HTML content
      const content = await page.content();
      const extract = (pattern) => {
        const match = content.match(pattern);
        return match ? match[0] : '';
      };

      const email = extract(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
      const website = extract(/https?:\/\/[^\s"'<>]+/);

      // Phone from rendered span tags
      const phone = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        const phonePattern = /\+?\d[\d\s().-]{5,}/;
        for (const span of spans) {
          const text = span.textContent.trim();
          if (phonePattern.test(text)) return text;
        }
        return '';
      });

      const result = {
        'Row Number': rowIndex + 1,
        'Page URL': url,
        'Page Name': title,
        'Email': email,
        'Phone': phone,
        'Website': website
      };

      results.push(result);
      console.log('💾 Saving to Excel...');
      const sheet = XLSX.utils.json_to_sheet(results);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Results');
      XLSX.writeFile(book, outputFile);

      console.log(`✅ Saved: ${url}`);

    } catch (err) {
      console.error(`❌ Error on ${url}: ${err.message}`);
      const errorResult = {
        'Row Number': rowIndex + 1,
        'Page URL': url,
        'Page Name': '',
        'Email': '',
        'Phone': '',
        'Website': ''
      };
      results.push(errorResult);

      const sheet = XLSX.utils.json_to_sheet(results);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Results');
      XLSX.writeFile(book, outputFile);

      console.log('⚠️ Error entry saved');
    }
  }

  console.log(`🎉 Done! All results saved to ${outputFile}`);
  await browser.close();
})();
