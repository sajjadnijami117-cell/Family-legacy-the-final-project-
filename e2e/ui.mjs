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

// newsletter has no counts any more
await go('newsletter', 'পারিবারিক পত্রিকা');
let t = await p.innerText('body');
ok('newsletter: no member-count footer', !t.includes('জন সদস্য') && !t.includes('জীবিত') && !t.includes('নতুন সদস্য'));

// branch colours
await go('tree', 'শাখা অনুযায়ী রং');
t = await p.innerText('body');
ok('branch legend shows', /-এর শাখা · \d+ জন/.test(t));
const chips = p.locator('button:has-text("-এর শাখা")');
const n = await chips.count();
console.log('branches', n);
ok('has branches', n > 0);
if (n > 0) {
  await chips.first().click();
  await p.waitForTimeout(300);
  const dimmed = await p.locator('button.opacity-30').count();
  ok('focus dims other branches', dimmed > 0);
  await chips.first().click();
  ok('second click restores', (await p.locator('button.opacity-30').count()) === 0);
}
const coloured = await p.locator('img[style*="border-color"]').count();
ok('avatars carry branch colour', coloured > 0);

// Eid strip
await go('eid', 'ঈদের ছবির ফিতা');
t = await p.innerText('body');
ok('eid strip shows newest year label', t.includes('ঈদুল ফিতর ২০২৫'));
ok('eid shows people', t.includes('ছবিতে ২ জন'));
ok('eid shows growth vs previous', t.includes('আগের ছবির চেয়ে ১ জন বেশি') && t.includes('নতুন মুখ'));
await p.locator('input[type=range]').fill('0');
await p.waitForTimeout(200);
ok('slider moves to first photo', (await p.innerText('body')).includes('ঈদুল ফিতর ২০২৪'));

// story
await go('story', 'আমার বংশের গল্প');
const sel = p.locator('select').first();
const opts = await sel.locator('option').evaluateAll(os => os.map(o => ({ v: o.value, t: o.textContent })).filter(o => o.v));
console.log('story options', opts.length);
const bn2n = (x) => Number(String(x).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)));
let best = null;
for (const o of opts) {
  await sel.selectOption(o.v);
  const counter = (await p.innerText('body')).match(/([০-৯]+)\/([০-৯]+)/);
  const total = counter ? bn2n(counter[2]) : 0;
  if (!best || total > best.total) best = { o, total };
}
console.log('chosen', JSON.stringify(best));
await sel.selectOption(best.o.v);
t = await p.innerText('body');
ok('story starts with the child name', /তোমার নাম/.test(t));
let pages = 1, sawGrand = false, sawAncestors = false;
for (let i = 0; i < 12; i++) {
  const next = p.locator('button:has-text("পরের পাতা")');
  if (await next.isDisabled()) break;
  await next.click(); pages++;
  const bt = await p.innerText('body');
  if (/তোমার (দাদা|নানা|দাদি|নানি)/.test(bt)) sawGrand = true;
  if (/সন্তান/.test(bt)) sawAncestors = true;
}
console.log('pages walked', pages);
ok('story reaches the last page', (await p.innerText('body')).includes('নতুন পাতা'));
ok('story mentions parents/grandparents with children', sawAncestors);
console.log('saw grandparents:', sawGrand);
const sample = (await p.innerText('body')).replace(/\n+/g, ' | ').slice(0, 500);
console.log('LAST PAGE:', sample);
console.log('LOGS:\n' + logs.join('\n'));
await b.close();
process.exit(fail ? 1 : 0);
