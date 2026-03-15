const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'tenis123';
const USERNAME = process.env.CEMOLIMPIA_USER;
const PASSWORD = process.env.CEMOLIMPIA_PASS;

app.post('/check-slots', async (req, res) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.goto('https://cemolimpia.matchpoint.com.es/Login.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('#ContentPlaceHolderContenido_Login1_UserName', USERNAME);
    await page.type('#ContentPlaceHolderContenido_Login1_Password', PASSWORD);
    await new Promise(r => setTimeout(r, 8000));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }),
      page.click('#ContentPlaceHolderContenido_Login1_LoginButton')
    ]);
    const loginUrl = page.url();
    if (!loginUrl.includes('Intranet') && !loginUrl.includes('intranet')) {
      await browser.close();
      return res.json({ success: false, error: 'Login basarisiz', loginUrl });
    }
    await page.goto('https://cemolimpia.matchpoint.com.es/Booking/Grid.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.select('select#calendarios', '5');
    await new Promise(r => setTimeout(r, 3000));
    const bosSlotlar = await page.$$eval('[onclick]', (elements) => {
      const slots = {};
      elements.forEach(el => {
        const oc = el.getAttribute('onclick') || '';
        const match = oc.match(/ajaxObtenerInformacionHuecoLibre\('([^']+)','([^']+)'\)/);
        if (match) {
          const saat = match[1];
          const kortNo = parseInt(match[2]) + 1;
          if (!slots[saat]) slots[saat] = [];
          slots[saat].push(kortNo);
        }
      });
      return slots;
    });
    await browser.close();
    res.json({ success: true, bosSlotlar, saatSayisi: Object.keys(bosSlotlar).length, kontrol: new Date().toISOString() });
  } catch (err) {
    console.error('Hata:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.listen(PORT, () => console.log('Tenis bot ' + PORT + ' portunda calisiyor'));
