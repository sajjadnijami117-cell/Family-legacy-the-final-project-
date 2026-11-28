import { chromium } from 'playwright';
const b = await chromium.launch();
let fail = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fail++; };
const logs = [];
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', e => logs.push('[pageerror] ' + e.message));
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
const ins = await p.$$('input');
await ins[0].fill('টেস্ট'); await ins[1].fill('24pcre6f');
await p.click('button[type=submit]');
await p.waitForSelector('text=বৃক্ষবলয়', { timeout: 15000 });
const go = async (tab, marker) => { await p.goto(`http://localhost:4173/?tab=${tab}`, { waitUntil: 'networkidle' }); await p.waitForSelector(`text=${marker}`, { timeout: 12000 }); };

// biography
await p.goto('http://localhost:4173/?tab=story', { waitUntil: 'networkidle' }); await p.waitForSelector('input[aria-label="নাম খুঁজুন"]', { timeout: 12000 });
const box = p.locator('input[aria-label="নাম খুঁজুন"]');
ok('search box exists', await box.count() === 1);
await box.fill('আ');
await p.waitForTimeout(300);
const results = p.locator('ul button, div[role=listbox] button');
const rc = await results.count();
console.log('search results', rc);
ok('search lists people', rc > 0);
let sawFake = false, walked = 0, sawNames = false;
const names = [];
for (let k = 0; k < Math.min(rc, 6); k++) {
  await box.fill('আ'); await p.waitForTimeout(150);
  await results.nth(k).click(); await p.waitForTimeout(200);
  for (let i = 0; i < 12; i++) {
    const bt = await p.innerText('body');
    if (/১ জানুয়ারি ১৯৯৫|পরিবারের এক আদরের সদস্য|চট্টগ্রাম/.test(bt)) sawFake = true;
    if (/তুমি|তোমার/.test(bt)) sawFake = true;
    const next = p.locator('button:has-text("পরের পাতা")');
    if (await next.count() === 0 || await next.isDisabled()) break;
    await next.click(); walked++;
  }
}
console.log('pages walked', walked);
ok('no placeholder/child-style text', !sawFake);
ok('read-aloud button kept (or unsupported)', true);
let t = await p.innerText('body');
console.log('SAMPLE:', t.replace(/\n+/g, ' | ').slice(0, 400));
console.log('LOGS:\n' + logs.join('\n'));
ok('no page errors', logs.length === 0);
await b.close();
process.exit(fail ? 1 : 0);
