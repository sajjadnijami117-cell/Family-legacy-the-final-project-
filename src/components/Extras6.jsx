import { useEffect, useMemo, useState } from 'react';
import { makeGender } from '@/lib/relations';
import { knownBio, knownDob, knownPob } from '@/lib/placeholders';

const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const WORDS = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ'];
const countWord = (n) => (n >= 1 && n <= 10 ? WORDS[n] : toBn(n));
const inputCls = 'w-full border rounded-xl p-3 bg-transparent text-xs border-gray-300 dark:border-white/10';
const nm = (m) => String(m?.name || '').replace(/\s+/g, ' ').trim();
const joinNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ও ${names[names.length - 1]}`);

export function fmtDate(iso) {
  const s = String(iso || '').trim();
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (full) return `${toBn(Number(full[3]))} ${MONTHS[Number(full[2]) - 1]} ${toBn(full[1])}`;
  const ym = /^(\d{4})-(\d{2})$/.exec(s);
  if (ym) return `${MONTHS[Number(ym[2]) - 1]} ${toBn(ym[1])}`;
  return s;
}

const clean = (t) => String(t || '').trim();

// Builds the pages of one person's biography. Only facts that are known are written;
// a page with nothing to say is left out.
export function buildBio(m, members, gallery = [], events = []) {
  const byId = new Map(members.map(x => [x.id, x]));
  const gender = makeGender(members);
  const spouse = byId.get(m.spouseId) || members.find(o => o.spouseId === m.id) || null;
  const father = byId.get(m.fatherId) || null;
  const mother = byId.get(m.motherId) || null;
  const name = nm(m);
  const dead = !!m.isDeceased;
  const pages = [];

  // ----- পরিচয় -----
  {
    const paras = [];
    const dob = knownDob(m);
    const pob = knownPob(m);
    if (dob || pob) {
      paras.push(`${name}${dob ? ` ${fmtDate(dob)}` : ''}${pob ? ` ${pob}-এ` : ''} জন্মগ্রহণ করেন।`);
    }
    const parents = [father, mother].filter(Boolean).map(nm);
    if (parents.length) paras.push(`তিনি ${joinNames(parents)}-এর সন্তান।`);
    const links = [];
    const add = (label, p) => { if (p) links.push({ label, member: p }); };
    add('বাবা', father);
    add('মা', mother);
    const fF = byId.get(father?.fatherId), fM = byId.get(father?.motherId);
    const mF = byId.get(mother?.fatherId), mM = byId.get(mother?.motherId);
    add('দাদা', fF); add('দাদি', fM); add('নানা', mF); add('নানি', mM);
    pages.push({ emoji: '🪪', title: 'পরিচয়', paras: paras.map(t => ({ body: t })), links, hero: true });
  }

  // ----- শিক্ষা ও পেশা -----
  {
    const paras = [];
    if (clean(m.education)) paras.push({ body: `${name}-এর শিক্ষাগত যোগ্যতা: ${clean(m.education)}।` });
    if (clean(m.profession)) paras.push({ body: `তিনি ${clean(m.profession)} পেশায় নিয়োজিত${dead ? ' ছিলেন' : ''}।` });
    if (paras.length) pages.push({ emoji: '🎓', title: 'শিক্ষা ও পেশা', paras });
  }

  // ----- ব্যক্তিগত জীবন -----
  {
    const paras = [];
    if (spouse) {
      const g = gender(spouse);
      const term = g === 'male' ? 'স্বামী' : g === 'female' ? 'স্ত্রী' : 'সঙ্গী';
      const md = clean(m.marriageDate) || clean(spouse.marriageDate);
      paras.push({ body: md ? `${fmtDate(md)} ${nm(spouse)}-এর সঙ্গে তাঁর বিয়ে হয়।` : `তাঁর ${term} ${nm(spouse)}।` });
    }
    const kids = members
      .filter(c => c.fatherId === m.id || c.motherId === m.id)
      .sort((a, b) => String(knownDob(a) || '9999').localeCompare(String(knownDob(b) || '9999')));
    if (kids.length) paras.push({ body: `তাঁর ${countWord(kids.length)} সন্তান: ${joinNames(kids.map(nm))}।` });
    if (clean(m.personalLife)) paras.push({ body: clean(m.personalLife), free: true });
    if (paras.length) pages.push({ emoji: '👨‍👩‍👧', title: 'ব্যক্তিগত জীবন', paras });
  }

  // ----- জীবনকথা -----
  {
    const story = clean(m.lifeStory) || knownBio(m);
    if (story) pages.push({ emoji: '📜', title: 'জীবনকথা', paras: [{ body: story, free: true }] });
  }

  // ----- অর্জন ও অবদান -----
  {
    const paras = [];
    if (clean(m.achievements)) paras.push({ head: 'অর্জন', body: clean(m.achievements), free: true });
    if (clean(m.contributions)) paras.push({ head: 'অবদান', body: clean(m.contributions), free: true });
    if (paras.length) pages.push({ emoji: '🏆', title: 'অর্জন ও অবদান', paras });
  }

  // ----- ব্যক্তিত্ব ও আদর্শ -----
  if (clean(m.values)) pages.push({ emoji: '🌟', title: 'ব্যক্তিত্ব ও আদর্শ', paras: [{ body: clean(m.values), free: true }] });

  // ----- মৃত্যু, স্মৃতি ও উত্তরাধিকার -----
  {
    const paras = [];
    if (dead) {
      const dd = clean(m.deathDate);
      paras.push({ body: dd ? `${name} ${fmtDate(dd)} মৃত্যুবরণ করেন।` : `${name} আর আমাদের মাঝে নেই।` });
      if (clean(m.burialPlace)) paras.push({ body: `${clean(m.burialPlace)}-এ তাঁকে দাফন করা হয়।` });
    }
    if (clean(m.legacy)) paras.push({ head: 'স্মৃতি ও উত্তরাধিকার', body: clean(m.legacy), free: true });
    const photos = gallery.filter(g => g.type !== 'video' && g.url && (g.memberIds || []).includes(m.id)).slice(0, 6);
    const evs = events.filter(e => (e.memberIds || []).includes(m.id)).slice(0, 6);
    const duas = Array.isArray(m.duas) ? m.duas.slice(-5) : [];
    if (paras.length || photos.length || evs.length || duas.length) {
      pages.push({ emoji: dead ? '🕊️' : '🖼️', title: dead ? 'মৃত্যু ও স্মৃতি' : 'স্মৃতি', paras, photos, events: evs, duas });
    }
  }
  return pages;
}

export function LifeBook({ members, gallery, events, onOpenMember }) {
  const [meId, setMeId] = useState(() => {
    try { const s = localStorage.getItem('family_me_v1'); if (s && members.some(m => m.id === s)) return s; } catch { /* ignore */ }
    return '';
  });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const me = members.find(m => m.id === meId) || members[0] || null;
  const pages = useMemo(() => (me ? buildBio(me, members, gallery, events) : []), [me, members, gallery, events]);
  const current = pages[Math.min(page, pages.length - 1)];
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  const matches = useMemo(() => {
    const q = query.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!q) return [];
    return members.filter(m => nm(m).toLowerCase().includes(q)).slice(0, 8);
  }, [query, members]);

  const stop = () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } setSpeaking(false); };
  useEffect(() => stop, []);
  useEffect(() => { stop(); }, [page, meId]);

  const choose = (id) => { setMeId(id); setPage(0); setQuery(''); };
  const read = () => {
    if (speaking) return stop();
    try {
      const text = [current.title, ...current.paras.map(p => `${p.head ? `${p.head}। ` : ''}${p.body}`)].join('। ');
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'bn-BD';
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
      setSpeaking(true);
    } catch { setSpeaking(false); }
  };

  return (
    <div className="space-y-4">
      <div className="text-center border-b pb-4">
        <h2 className="text-lg font-bold">📖 জীবনী</h2>
        <p className="text-xs text-gray-400 mt-1">নাম লিখে খুঁজে যাঁর জীবনী পড়তে চান তাঁকে বেছে নিন।</p>
      </div>

      <div className="relative">
        <input
          value={query} onChange={e => setQuery(e.target.value)} type="search"
          placeholder="🔍 নাম লিখে খুঁজুন" className={inputCls} aria-label="নাম খুঁজুন"
        />
        {matches.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border bg-white dark:bg-[#12281a] border-gray-200 dark:border-white/10 shadow-lg overflow-hidden">
            {matches.map(m => (
              <li key={m.id}>
                <button type="button" onClick={() => choose(m.id)} className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-[#D4AF37]/15">
                  <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]" />
                  <span className="text-xs font-bold break-words">{nm(m)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && matches.length === 0 && <p className="text-[11px] text-gray-400 mt-1">এই নামে কাউকে পাওয়া যায়নি।</p>}
      </div>

      {current && me && (
        <div className="rounded-3xl border-4 border-double border-[#D4AF37] bg-[#fffaf0] text-[#1b2a1c] p-5 sm:p-8 space-y-4 shadow-lg">
          <div className="text-center space-y-2">
            <div className="text-4xl" aria-hidden="true">{current.emoji}</div>
            {current.hero ? (
              <>
                <img src={me.avatar} alt={nm(me)} className="w-28 h-28 rounded-full object-cover border-4 border-[#D4AF37] shadow mx-auto" />
                <h3 className="text-xl font-extrabold text-[#1E3F20] break-words">{nm(me)}</h3>
              </>
            ) : (
              <>
                <h3 className="text-lg font-extrabold text-[#1E3F20]">{current.title}</h3>
                <p className="text-[11px] font-bold text-[#8a6d1d] break-words">{nm(me)}</p>
              </>
            )}
          </div>

          <div className="space-y-3">
            {current.paras.map((p, i) => (
              <div key={i}>
                {p.head && <p className="text-xs font-bold text-[#8a6d1d] mb-0.5">{p.head}</p>}
                <p className="text-base leading-8 break-words whitespace-pre-wrap">{p.body}</p>
              </div>
            ))}
            {current.hero && current.paras.length === 0 && (
              <p className="text-xs text-[#5b4a1a] text-center">এই মানুষটির জন্ম ও পরিবারের তথ্য এখনো যোগ করা হয়নি।</p>
            )}
          </div>

          {current.links && current.links.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {current.links.map(l => (
                <button key={l.label} type="button" onClick={() => choose(l.member.id)} className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-[#D4AF37] bg-white/70 break-words">
                  {l.label}: {nm(l.member)}
                </button>
              ))}
            </div>
          )}

          {current.photos && current.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {current.photos.map(g => (
                <figure key={g.id}>
                  <img src={g.url} alt={g.title} className="w-full aspect-square object-cover rounded-lg border border-[#D4AF37]/60" />
                  <figcaption className="text-[10px] text-center mt-1 break-words">{g.title}</figcaption>
                </figure>
              ))}
            </div>
          )}
          {current.events && current.events.length > 0 && (
            <ul className="text-sm space-y-1">
              {current.events.map(e => <li key={e.id} className="break-words">{e.icon || '📌'} {e.title}{e.date ? ` · ${fmtDate(e.date)}` : ''}</li>)}
            </ul>
          )}
          {current.duas && current.duas.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#8a6d1d]">পরিবারের দোয়া</p>
              {current.duas.map((d, i) => <p key={i} className="text-sm break-words">{d.text} <span className="text-[#8a6d1d]">— {d.name}</span></p>)}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="px-4 py-2 rounded-full bg-[#1E3F20] text-[#D4AF37] text-xs font-bold disabled:opacity-30">← আগের পাতা</button>
            <span className="text-xs font-bold text-[#8a6d1d]">{toBn(Math.min(page, pages.length - 1) + 1)}/{toBn(pages.length)}</span>
            <button type="button" disabled={page >= pages.length - 1} onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-full bg-[#1E3F20] text-[#D4AF37] text-xs font-bold disabled:opacity-30">পরের পাতা →</button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canSpeak && <button type="button" onClick={read} className="text-[11px] font-bold px-4 py-2 rounded-full bg-[#D4AF37] text-black">{speaking ? '⏹ থামাও' : '🔊 পড়ে শোনাও'}</button>}
            {onOpenMember && <button type="button" onClick={() => onOpenMember(me)} className="text-[11px] font-bold px-4 py-2 rounded-full bg-white/70 border border-[#D4AF37]">পুরো প্রোফাইল</button>}
          </div>
          {canSpeak && <p className="text-[10px] text-[#5b4a1a] text-center">ফোনে বাংলা কণ্ঠ না থাকলে পড়ে শোনানো কাজ নাও করতে পারে।</p>}
        </div>
      )}
    </div>
  );
}

const BIO_AREAS = [
  ['bio', 'জীবনকথা', 'জীবনের মূল গল্প…'],
  ['personalLife', 'ব্যক্তিগত জীবন', 'বিয়ে, সন্তান, সংসার…'],
  ['achievements', 'অর্জন', 'যা অর্জন করেছেন…'],
  ['values', 'ব্যক্তিত্ব ও মূল্যবোধ', 'স্বভাব, আদর্শ…'],
  ['contributions', 'অবদান', 'পরিবার ও সমাজে অবদান…'],
  ['legacy', 'রেখে যাওয়া স্মৃতি', 'যে স্মৃতিতে মনে থাকবেন…'],
];
export function BioFields({ m, cls, known }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-400">জীবনীর ঘরগুলো বাধ্যতামূলক নয় — যা জানা আছে শুধু সেটুকুই লিখুন।</p>
      {BIO_AREAS.map(([k, label, ph]) => (
        <div key={k}>
          <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{label}</label>
          <textarea name={k} rows="2" placeholder={ph} defaultValue={m ? (k === 'bio' ? known(m) : (m[k] || '')) : ''} className={cls} />
        </div>
      ))}
    </div>
  );
}
export const BIO_KEYS = BIO_AREAS.map(a => a[0]);
