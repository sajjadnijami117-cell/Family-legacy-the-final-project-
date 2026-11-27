// Interface language switch (Bengali / English).
// The text typed into the archive (names, biographies, events) is never translated.
// Fixed screen text is swapped by looking it up in this dictionary.

const EN = {
  '📰 পত্রিকা': '📰 Newsletter',
  '📰 পারিবারিক পত্রিকা': '📰 Family newsletter',
  '💬 হোয়াটসঅ্যাপে পাঠান': '💬 Send on WhatsApp',
  '🖨️ PDF / প্রিন্ট': '🖨️ PDF / Print',
  '⏳ টাইম ক্যাপসুল': '⏳ Time capsule',
  '👁️ তাঁর চোখে দেখুন': '👁️ See through their eyes',
  '🔔 ফোনে নোটিফিকেশন': '🔔 Phone notifications',
  '✍️ নতুন চিঠি লিখুন': '✍️ Write a new letter',
  '💌 খুলে গেছে': '💌 Opened',
  '🔒 তালা দিয়ে রাখুন': '🔒 Lock it away',
  'এই ফোনে চালু করুন': 'Turn on for this phone',
  'চিঠি পড়ুন': 'Read the letter',
  'সাধারণ গাছ': 'Normal tree',
  'আমার চোখে': 'Through my eyes',
  'কাসেম ও আয়েশা ঐতিহ্য আর্কাইভ': 'Kasem & Ayesha Heritage Archive',
  'আমাদের শেকড় • আমাদের অহংকার': 'Our roots • Our pride',
  'আবদুল মোতালেব ও আয়েশা খাতুন পরিবার': 'Abdul Mutalib & Ayesha Khatun Family',
  'সুরক্ষিত পারিবারিক ঐতিহ্য ও আর্কাইভ পোর্টাল': 'Secure family heritage & archive portal',
  'সদস্য লগইন': 'Member login',
  'অ্যাডমিন লগইন': 'Admin login',
  'আপনার নাম': 'Your name',
  'পারিবারিক কোড': 'Family code',
  'পারিবারিক আর্কাইভে প্রবেশ করুন': 'Enter the family archive',
  'অ্যাডমিন প্যানেলে প্রবেশ করুন': 'Enter the admin panel',
  'অ্যাডমিন ইমেইল': 'Admin email',
  'পাসওয়ার্ড': 'Password',
  'হোম': 'Home',
  'হোম ড্যাশবোর্ড': 'Home dashboard',
  'পারিবারিক গাছ': 'Family tree',
  'সদস্য তালিকা': 'Members',
  'গ্যালারি': 'Gallery',
  'টাইমলাইন': 'Timeline',
  '✉️ তথ্য পাঠান': '✉️ Send info',
  '🕯️ স্মরণ': '🕯️ Remembrance',
  'থিম পরিবর্তন': 'Change theme',
  'লগআউট': 'Log out',
  'কাসেম পরিবার': 'Kasem family',
  'ডিজিটাল পারিবারিক সংগ্রহশালা': 'Digital family museum',
  'আপনার শিকড়কে জানুন, ঐতিহ্যকে বাঁচিয়ে রাখুন': 'Know your roots, keep the heritage alive',
  'স্মৃতি গ্যালারি': 'Memory gallery',
  '📸 স্মৃতি গ্যালারি': '📸 Memory gallery',
  '🌲 পারিবারিক গাছ': '🌲 Family tree',
  'মোট সদস্য': 'Total members',
  'পরম শিকড়': 'Ancestor',
  'মাইলস্টোন': 'Milestones',
  'স্মৃতিচিত্র': 'Photos',
  'পারিবারিক সোনালী ইতিহাস': 'Our golden family history',
  'সকল ঘটনা →': 'All events →',
  '🕊️ চিরস্মরণীয় অভিভাবক': '🕊️ Beloved elders',
  'মরহুম': 'Late',
  'মরহুম/মরহুমা': 'Late',
  'মরহুম পূর্বপুরুষ': 'Late ancestor',
  'স্মরণীয় পূর্বপুরুষ': 'Remembered ancestor',
  '🌲 আমাদের পারিবারিক বৃক্ষ': '🌲 Our family tree',
  'দম্পতি ও তাঁদের সন্তান, তারপর সন্তানের দম্পতি ও তাঁদের সন্তান, এভাবে প্রজন্মের পর প্রজন্ম।': 'Couples and their children, then each child\'s couple and their children, generation after generation.',
  'সব খুলুন': 'Expand all',
  'সব গুটান': 'Collapse all',
  '🖨️ PDF / প্রিন্ট': '🖨️ PDF / Print',
  'সম্পর্ক অনির্ধারিত': 'Relationship not set',
  'পরম শিকড়': 'Root generation',
  'দ্বিতীয় প্রজন্ম': '2nd generation',
  'তৃতীয় প্রজন্ম': '3rd generation',
  'চতুর্থ প্রজন্ম': '4th generation',
  'পঞ্চম প্রজন্ম': '5th generation',
  'ষষ্ঠ প্রজন্ম': '6th generation',
  '🔎 সম্পর্ক নির্ণয়': '🔎 Find relationship',
  'আমি (বা প্রথম জন)': 'Me (or first person)',
  'দ্বিতীয় জন': 'Second person',
  'বেছে নিন': 'Select',
  '📇 পারিবারিক সদস্য তালিকা': '📇 Family members',
  'পরিবারের সকল সদস্যদের খোঁজখবর এক জায়গায়।': 'All family members in one place.',
  'নাম, পেশা বা জেলা লিখে খুঁজুন...': 'Search by name, profession or place...',
  'সবাই': 'Everyone',
  'জীবিত': 'Living',
  'সাজানো: ডিফল্ট': 'Sort: default',
  'নাম অনুযায়ী': 'By name',
  'বড় থেকে ছোট (বয়স)': 'Oldest first (age)',
  'বিস্তারিত': 'Details',
  'পেশা অনির্ধারিত': 'Profession not set',
  '🔍 কোনো সদস্য খুঁজে পাওয়া যায়নি।': '🔍 No members found.',
  '🖼️ পারিবারিক স্মৃতি গ্যালারি': '🖼️ Family memory gallery',
  '📜 পারিবারিক মাইলস্টোন ও টাইমলাইন': '📜 Family milestones & timeline',
  '✉️ নতুন সদস্যের তথ্য পাঠান': '✉️ Send a new member\'s details',
  'নতুন সদস্যের তথ্য এখানে পাঠান। অ্যাডমিন যাচাই করে অনুমোদন দিলে তবেই সাইটে দেখা যাবে।': 'Send a new member\'s details here. They appear on the site only after an admin approves.',
  'সদস্যের নাম *': 'Member name *',
  'লিঙ্গ': 'Gender',
  'ছেলে / পুরুষ': 'Male',
  'মেয়ে / নারী': 'Female',
  'জন্ম তারিখ': 'Date of birth',
  'বাবা': 'Father',
  'মা': 'Mother',
  'স্বামী / স্ত্রী': 'Spouse',
  'বিবাহের তারিখ': 'Marriage date',
  'পেশা': 'Profession',
  'জন্মস্থান / জেলা': 'Birthplace / district',
  'সংক্ষিপ্ত পরিচিতি': 'Short introduction',
  'নেই / জানি না': 'None / unknown',
  'অনুরোধ পাঠান': 'Send request',
  'পাঠানো হচ্ছে...': 'Sending...',
  'জন্ম': 'Born',
  'স্থান': 'Place',
  'শিক্ষা': 'Education',
  'মোবাইল': 'Mobile',
  'ঠিকানা': 'Address',
  'গোপন': 'Private',
  'জীবনী পাওয়া যায়নি।': 'No biography available.',
  'অনির্ধারিত': 'Not set',
  '🎂 আসন্ন জন্মদিন ও বিবাহবার্ষিকী': '🎂 Upcoming birthdays & anniversaries',
  'আজ!': 'Today!',
  '📸 এঁর ছবি': '📸 Photos of this person',
  '📅 জড়িত ঘটনা': '📅 Related events',
  '📲 ফোনে অ্যাপের মতো রাখুন': '📲 Install on your phone',
  'ছবিতে কারা আছেন': 'Who is in the photo',
  'যাদের ট্যাগ করবেন': 'People to tag',
  'নাম খুঁজুন...': 'Search name...',
  'অ্যাডমিন ড্যাশবোর্ড ওভারভিউ': 'Admin dashboard overview',
  'ওভারভিউ': 'Overview',
  'সদস্য ব্যবস্থাপনা': 'Member management',
  'পেন্ডিং অনুরোধ': 'Pending requests',
  'নতুন সদস্য যোগ করুন': 'Add new member',
  'টাইমলাইন / ইভেন্ট': 'Timeline / events',
  'গ্যালারি ব্যবস্থাপনা': 'Gallery management',
  'ব্যাকআপ / ইমপোর্ট': 'Backup / import',
  'সিস্টেম লগ': 'System log',
  'অ্যাডমিন ব্যবস্থাপনা': 'Admin management',
  'সুপার অ্যাডমিন': 'Super admin',
  'সহকারী অ্যাডমিন': 'Assistant admin',
  'এপ্রুভ': 'Approve',
  'প্রত্যাখ্যান': 'Reject',
  'দেখুন': 'View',
  'এডিট': 'Edit',
  'ডিলিট': 'Delete',
  'বাতিল': 'Cancel',
  'আপলোড': 'Upload',
  'ছবি আপলোড': 'Upload photo',
  'শিরোনাম': 'Title',
  'তারিখ': 'Date',
  'বিবরণ': 'Description',
  'ছবি ফাইল': 'Photo file',
  'ভূমিকা': 'Role',
  'জীবনী': 'Biography',
  'নাম': 'Name',
  '💾 ব্যাকআপ নামান': '💾 Download backup',
  '📥 ইমপোর্ট': '📥 Import',
  'JSON ব্যাকআপ': 'JSON backup',
  'সদস্য তালিকা (Excel/CSV)': 'Member list (Excel/CSV)',
  '🔑 পারিবারিক কোড বদলান': '🔑 Change family code',
  'কোড বদলান': 'Change code',
  'লোড হচ্ছে...': 'Loading...',
  'পারিবারিক কোড সঠিক নয়!': 'Incorrect family code!',
  // new features
  '📊 পরিবারের পরিসংখ্যান': '📊 Family statistics',
  'জীবিত সদস্য': 'Living members',
  'মরহুম সদস্য': 'Late members',
  'প্রজন্ম': 'Generations',
  'পুরুষ': 'Male',
  'নারী': 'Female',
  'বয়স অনুযায়ী ভাগ': 'By age group',
  'শিশু ও কিশোর (০-১৭)': 'Children & teens (0-17)',
  'তরুণ (১৮-৩৫)': 'Young adults (18-35)',
  'মধ্যবয়সী (৩৬-৫৯)': 'Middle-aged (36-59)',
  'প্রবীণ (৬০+)': 'Elders (60+)',
  'পেশা': 'Profession',
  'এলাকা': 'Area',
  '📢 পারিবারিক ঘোষণা': '📢 Family announcements',
  'হোম পেজে ঘোষণা হিসেবে দেখান': 'Show as an announcement on the home page',
  '📞 কল': '📞 Call',
  '💬 হোয়াটসঅ্যাপ': '💬 WhatsApp',
  '✉️ এসএমএস': '✉️ SMS',
  '✏️ তথ্য সংশোধনের অনুরোধ': '✏️ Request a correction',
  'সংশোধনের অনুরোধ পাঠান': 'Send correction request',
  'যে তথ্য বদলাতে চান শুধু সেগুলো লিখুন। অ্যাডমিন অনুমোদন দিলে বদলাবে।': 'Fill in only what should change. It will change after an admin approves.',
  'আপনার নাম (অনুরোধকারী)': 'Your name (requester)',
  '🕯️ স্মরণ ও দোয়া': '🕯️ Remembrance & prayers',
  'মরহুম সদস্যদের স্মরণে। দোয়া লিখে রাখুন, পরিবারের সবাই দেখতে পাবে।': 'In memory of our late members. Leave a prayer for the whole family to see.',
  'মৃত্যুর তারিখ': 'Date of death',
  'কবরের স্থান': 'Resting place',
  'মরহুম / মরহুমা': 'Deceased',
  'দোয়া ও স্মৃতি': 'Prayers & memories',
  'দোয়া লিখুন...': 'Write a prayer...',
  'পাঠান': 'Send',
  'এখনো কোনো দোয়া লেখা হয়নি।': 'No prayers yet.',
  'কোনো মরহুম সদস্য নেই।': 'No late members.',
  '🕯️ স্মরণ পাতা': '🕯️ Remembrance page',
  'ভাষা': 'Language',
};

const STORAGE = 'family_lang_v1';
const SUB_MIN = 6; // shorter keys only match whole text, so they cannot damage longer words

// Bengali letters can be stored in more than one way (for example "ো" as one character or as "ে"+"া"),
// so both the dictionary and the screen text are put into one form before comparing.
const norm = (s) => s.normalize('NFC').replace(/\u09C7\u09BE/g, '\u09CB').replace(/\u09C7\u09D7/g, '\u09CC');

const DICT = {};
for (const [k, v] of Object.entries(EN)) DICT[norm(k)] = v;
const exact = new Map(Object.entries(DICT));
const subs = Object.keys(DICT).filter(k => k.length >= SUB_MIN).sort((a, b) => b.length - a.length);

const translate = (text) => {
  const t = norm(text);
  const trimmed = t.trim();
  if (!trimmed) return text;
  if (exact.has(trimmed)) return t.replace(trimmed, exact.get(trimmed));
  let out = t;
  for (const k of subs) if (out.includes(k)) out = out.split(k).join(DICT[k]);
  return out;
};

let lang = 'bn';
try { lang = localStorage.getItem(STORAGE) === 'en' ? 'en' : 'bn'; } catch { /* ignore */ }

const textRec = new WeakMap(); // text node -> { orig, shown }
const attrRec = new WeakMap(); // element -> { attr: { orig, shown } }
let observer = null;
let queued = false;
const listeners = new Set();

function applyText(node) {
  const rec = textRec.get(node);
  const cur = node.nodeValue;
  const orig = rec && cur === rec.shown ? rec.orig : cur;
  const shown = lang === 'en' ? translate(orig) : orig;
  if (shown !== cur) node.nodeValue = shown;
  if (lang === 'en' && shown !== orig) textRec.set(node, { orig, shown });
  else textRec.delete(node);
}

function applyAttrs(el) {
  for (const attr of ['placeholder', 'title']) {
    if (!el.hasAttribute || !el.hasAttribute(attr)) continue;
    const recs = attrRec.get(el) || {};
    const cur = el.getAttribute(attr);
    const rec = recs[attr];
    const orig = rec && cur === rec.shown ? rec.orig : cur;
    const shown = lang === 'en' ? translate(orig) : orig;
    if (shown !== cur) el.setAttribute(attr, shown);
    if (lang === 'en' && shown !== orig) recs[attr] = { orig, shown }; else delete recs[attr];
    attrRec.set(el, recs);
  }
}

function walk(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = walker.currentNode;
  while (n) {
    if (n.nodeType === 3) {
      const p = n.parentNode;
      if (!p || (p.nodeName !== 'SCRIPT' && p.nodeName !== 'STYLE' && p.nodeName !== 'TEXTAREA')) applyText(n);
    } else if (n.nodeType === 1) applyAttrs(n);
    n = walker.nextNode();
  }
}

function run() {
  queued = false;
  if (observer) observer.disconnect();
  try { walk(document.body); } catch { /* never break the page for a translation */ }
  if (observer) observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'title'] });
}

const schedule = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(run);
};

export function startI18n() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(() => { if (lang === 'en') schedule(); });
  document.documentElement.lang = lang === 'en' ? 'en' : 'bn';
  run();
}

export const getLang = () => lang;

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'bn';
  try { localStorage.setItem(STORAGE, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  run();
  listeners.forEach(fn => fn(lang));
}

export const onLangChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
