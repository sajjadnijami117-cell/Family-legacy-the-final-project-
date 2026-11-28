import { useEffect, useMemo, useState } from 'react';
import { relationTerm } from '@/lib/relations';

const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const inputCls = 'w-full border rounded-xl p-3 bg-transparent text-xs border-gray-300 dark:border-white/10';
const WORDS = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ'];
const countWord = (n) => (n >= 1 && n <= 10 ? WORDS[n] : toBn(n));
const joinNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ও ${names[names.length - 1]}`);
const yearOf = (iso) => (/^\d{4}/.test(iso || '') ? Number(String(iso).slice(0, 4)) : null);

// ======================================================================
// ঈদের ছবির ফিতা
// ======================================================================
export const EID_KINDS = { fitr: 'ঈদুল ফিতর', adha: 'ঈদুল আযহা' };

export function EidStrip({ gallery, members, setGallery, isAdmin }) {
  const items = useMemo(
    () => gallery.filter(g => g.eid && g.url).sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [gallery],
  );
  const [who, setWho] = useState('');
  const shown = useMemo(() => items.filter(g => !who || (g.memberIds || []).includes(who)), [items, who]);
  const [idx, setIdx] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [pick, setPick] = useState('');
  const [kind, setKind] = useState('fitr');
  const names = useMemo(() => Object.fromEntries(members.map(m => [m.id, m.name])), [members]);

  const cur = shown.length ? Math.min(idx === null ? shown.length - 1 : idx, shown.length - 1) : -1;
  const photo = cur >= 0 ? shown[cur] : null;
  const prev = cur > 0 ? shown[cur - 1] : null;

  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => {
      setIdx(i => {
        const now = i === null ? shown.length - 1 : i;
        if (now >= shown.length - 1) { setPlaying(false); return now; }
        return now + 1;
      });
    }, 2600);
    return () => clearInterval(t);
  }, [playing, shown.length]);

  const play = () => {
    if (cur >= shown.length - 1) setIdx(0);
    setPlaying(p => !p);
  };

  const mark = (id, value) => setGallery(prevList => prevList.map(g => (g.id === id ? { ...g, eid: value } : g)));
  const candidates = gallery.filter(g => !g.eid && g.type !== 'video' && g.url);

  const tagged = photo ? (photo.memberIds || []) : [];
  const prevTagged = prev ? (prev.memberIds || []) : [];
  const newcomers = tagged.filter(id => !prevTagged.includes(id));
  const diff = prev && tagged.length && prevTagged.length ? tagged.length - prevTagged.length : null;
  const label = (g) => `${EID_KINDS[g.eid] || 'ঈদ'} ${toBn(yearOf(g.date) || '')}`.trim();

  return (
    <div className="space-y-4">
      <div className="text-center border-b pb-4">
        <h2 className="text-lg font-bold">🌙 ঈদের ছবির ফিতা</h2>
        <p className="text-xs text-gray-400 mt-1">বছর বছর ঈদের পারিবারিক ছবি এক সারিতে। স্লাইডার টানলে দেখা যাবে পরিবার কীভাবে বদলেছে।</p>
      </div>

      {items.length > 0 && (
        <select value={who} onChange={e => { setWho(e.target.value); setIdx(null); setPlaying(false); }} className={inputCls}>
          <option value="">সব ছবি</option>
          {members.map(m => <option key={m.id} value={m.id}>শুধু যে ছবিতে {m.name} আছেন</option>)}
        </select>
      )}

      {photo ? (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden border-2 border-[#D4AF37] bg-black/5">
            <img src={photo.url} alt={photo.title} className="w-full max-h-[70vh] object-contain bg-black/10" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-extrabold text-[#8a6d1d]">{label(photo)}</p>
            <p className="text-xs font-bold break-words">{photo.title}</p>
            {photo.description && <p className="text-[11px] text-gray-500 break-words">{photo.description}</p>}
            {tagged.length > 0 && (
              <p className="text-[11px] text-gray-500 break-words">
                ছবিতে {toBn(tagged.length)} জন: {joinNames(tagged.map(id => names[id] || 'সদস্য'))}
              </p>
            )}
            {diff !== null && (
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                আগের ছবির চেয়ে {diff > 0 ? `${toBn(diff)} জন বেশি` : diff < 0 ? `${toBn(-diff)} জন কম` : 'একই সংখ্যক মানুষ'}
                {newcomers.length > 0 && ` · নতুন মুখ: ${joinNames(newcomers.map(id => names[id] || 'সদস্য'))}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={play} className="shrink-0 text-[11px] font-bold px-4 py-2 rounded-full bg-[#1E3F20] text-[#D4AF37]">{playing ? '⏸ থামান' : '▶ চালান'}</button>
            <input
              type="range" min={0} max={Math.max(shown.length - 1, 0)} value={cur}
              onChange={e => { setPlaying(false); setIdx(Number(e.target.value)); }}
              className="flex-1 accent-[#D4AF37]" aria-label="বছর বাছুন"
            />
            <span className="shrink-0 text-[11px] font-bold">{toBn(cur + 1)}/{toBn(shown.length)}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {shown.map((g, i) => (
              <button key={g.id} type="button" onClick={() => { setPlaying(false); setIdx(i); }} className={`shrink-0 w-20 text-center ${i === cur ? 'opacity-100' : 'opacity-60'}`}>
                <img src={g.url} alt={g.title} className={`w-20 h-20 object-cover rounded-lg border-2 ${i === cur ? 'border-[#D4AF37]' : 'border-transparent'}`} />
                <span className="block text-[10px] font-bold mt-1">{toBn(yearOf(g.date) || '')}</span>
              </button>
            ))}
          </div>

          {isAdmin && (
            <button type="button" onClick={() => { if (window.confirm('এই ছবিটি ঈদের ফিতা থেকে সরাবেন? (গ্যালারিতে থাকবে)')) { mark(photo.id, ''); setIdx(null); } }} className="text-[10px] font-bold text-red-500">এই ছবি ফিতা থেকে সরান</button>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-8">
          {items.length === 0
            ? 'এখনো ফিতায় কোনো ছবি নেই। গ্যালারিতে ছবি আপলোডের সময় "ঈদের ছবি" বেছে নিলে এখানে আসবে।'
            : 'এই সদস্যের কোনো ঈদের ছবি পাওয়া যায়নি। ছবিতে কারা আছেন তা চিহ্নিত করা থাকলে তবেই এখানে আসে।'}
        </p>
      )}

      {isAdmin && (
        <div className="p-4 rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 space-y-2 text-xs">
          <p className="font-bold">➕ গ্যালারির ছবি ফিতায় যোগ করুন</p>
          {candidates.length === 0 ? (
            <p className="text-[11px] text-gray-400">যোগ করার মতো আর কোনো ছবি গ্যালারিতে নেই। নতুন ছবি গ্যালারিতে আপলোড করুন।</p>
          ) : (
            <>
              <select value={pick} onChange={e => setPick(e.target.value)} className={inputCls}>
                <option value="">ছবি বাছুন</option>
                {candidates.map(g => <option key={g.id} value={g.id}>{g.title} ({g.date})</option>)}
              </select>
              <select value={kind} onChange={e => setKind(e.target.value)} className={inputCls}>
                {Object.entries(EID_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" disabled={!pick} onClick={() => { mark(pick, kind); setPick(''); setIdx(null); }} className="w-full py-2.5 rounded-xl bg-[#1E3F20] text-[#D4AF37] font-bold disabled:opacity-40">ফিতায় যোগ করুন</button>
              <p className="text-[10px] text-gray-400">বছর আসবে ছবির তারিখ থেকে, তাই গ্যালারিতে ছবির তারিখ সঠিক রাখুন।</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ======================================================================
// ছোটদের জন্য "আমার বংশের গল্প"
// ======================================================================
export function buildStory(me, members) {
  const byId = new Map(members.map(m => [m.id, m]));
  const spouseOf = (m) => byId.get(m.spouseId) || members.find(o => o.spouseId === m.id) || null;
  const kidsOf = (ids) => members.filter(c => ids.includes(c.fatherId) || ids.includes(c.motherId));
  const alive = (people) => people.every(p => !p.isDeceased);
  const pages = [];

  pages.push({
    emoji: '🌱',
    title: 'তোমার গল্প',
    text: `তোমার নাম ${me.name}। তুমি আমাদের পরিবারের একজন প্রিয় সদস্য। চলো, আজ তোমার শিকড়ের গল্প শুনি, কারা তোমার আগে এসেছিলেন আর কীভাবে তুমি এই বড় গাছের একটা পাতা হলে।`,
    people: [me],
  });

  // Walk up the family tree one generation at a time.
  let gen = [me];
  const used = new Set();
  const ancestorIds = new Set([me.id]);
  let found = 0;
  for (let level = 1; level <= 6; level++) {
    const parents = [];
    gen.forEach(p => [p.fatherId, p.motherId].forEach(id => {
      const a = byId.get(id);
      if (a && !parents.some(x => x.id === a.id)) parents.push(a);
    }));
    if (parents.length === 0) break;
    parents.forEach(p => ancestorIds.add(p.id));

    for (const a of parents) {
      if (used.has(a.id)) continue;
      // pair two parents of the same line; a remarried partner is not assumed to be a parent
      const sp = spouseOf(a);
      const group = sp && !used.has(sp.id) && parents.some(x => x.id === sp.id) ? [a, sp] : [a];
      group.forEach(x => used.add(x.id));
      found++;

      const terms = [...new Set(group.map(x => relationTerm(me, x, members)))];
      const termText = terms.join(' ও ');
      const dead = !alive(group);
      const kids = kidsOf(group.map(x => x.id));
      const lineKid = kids.find(k => k.id === me.id || ancestorIds.has(k.id));
      const lineTerm = lineKid && lineKid.id !== me.id ? relationTerm(me, lineKid, members) : '';
      const sentences = [`তোমার ${termText} ${dead ? 'ছিলেন' : 'হলেন'} ${joinNames(group.map(x => x.name))}।`];
      if (kids.length > 0) {
        sentences.push(`${group.length > 1 ? 'তাঁদের' : 'তাঁর'} ${countWord(kids.length)} সন্তান${dead ? ' ছিল' : ''}${kids.length <= 8 ? `: ${joinNames(kids.map(k => k.name))}` : ''}।`);
      }
      if (lineKid) sentences.push(lineKid.id === me.id ? 'এঁদের একজন হলে তুমি!' : `এঁদেরই একজন তোমার ${lineTerm}।`);
      if (dead) sentences.push(`আল্লাহ ${group.length > 1 ? 'তাঁদের' : 'তাঁকে'} জান্নাত দান করুন।`);
      pages.push({
        emoji: level === 1 ? '🏡' : level === 2 ? '🌳' : '🕰️',
        title: `তোমার ${termText}`,
        text: sentences.join(' '),
        people: group,
      });
    }
    gen = parents;
  }

  if (found === 0) {
    pages.push({
      emoji: '🔍', title: 'গল্প এখনো ছোট',
      text: 'গাছে তোমার বাবা-মায়ের তথ্য এখনো যোগ করা হয়নি। যোগ হলে গল্পটা অনেক বড় হয়ে যাবে। বড়দের বলো তথ্য দিতে।',
      people: [],
    });
  }

  pages.push({
    emoji: '🌲',
    title: 'আমাদের বড় গাছ',
    text: `এই গাছে এখন ${toBn(members.length)} জন মানুষ আছেন, আর প্রত্যেকেই কারও না কারও আপনজন। প্রতিটি নামের পেছনে একটা করে গল্প আছে।`,
    people: [],
  });
  pages.push({
    emoji: '🍃',
    title: 'তুমি নতুন পাতা',
    text: `${me.name}, তুমি এই গাছের নতুন পাতা। বড় হয়ে তুমিও তোমার আপনজনদের গল্প মনে রেখো, আর অন্যদের শোনাও। দোয়া করি, তুমি ভালো মানুষ হয়ে বড় হও।`,
    people: [me],
  });
  return pages;
}

export function ChildStory({ members }) {
  const [meId, setMeId] = useState(() => { try { return localStorage.getItem('family_me_v1') || ''; } catch { return ''; } });
  const [page, setPage] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const me = members.find(m => m.id === meId) || null;
  const pages = useMemo(() => (me ? buildStory(me, members) : []), [me, members]);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  const p = pages[Math.min(page, pages.length - 1)];

  const stop = () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } setSpeaking(false); };
  useEffect(() => stop, []);
  useEffect(() => { stop(); }, [page, meId]);

  const choose = (id) => {
    setMeId(id); setPage(0);
    try { localStorage.setItem('family_me_v1', id); } catch { /* ignore */ }
  };
  const read = () => {
    if (speaking) return stop();
    try {
      const u = new window.SpeechSynthesisUtterance(`${p.title}। ${p.text}`);
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
        <h2 className="text-lg font-bold">📖 আমার বংশের গল্প</h2>
        <p className="text-xs text-gray-400 mt-1">ছোটদের জন্য। একজনকে বেছে নিলে গাছ থেকে তার নিজের গল্প তৈরি হবে।</p>
      </div>

      <select value={meId} onChange={e => choose(e.target.value)} className={inputCls}>
        <option value="">কার গল্প শুনবে? বেছে নাও</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>

      {p && (
        <div className="rounded-3xl border-4 border-double border-[#D4AF37] bg-[#fffaf0] text-[#1b2a1c] p-5 sm:p-8 text-center space-y-4 shadow-lg">
          <div className="text-5xl" aria-hidden="true">{p.emoji}</div>
          <h3 className="text-lg font-extrabold text-[#1E3F20] break-words">{p.title}</h3>
          {p.people.length > 0 && (
            <div className="flex justify-center gap-4 flex-wrap">
              {p.people.map(x => (
                <figure key={x.id} className="w-24">
                  <img src={x.avatar} alt={x.name} className="w-24 h-24 rounded-full object-cover border-4 border-[#D4AF37] shadow" />
                  <figcaption className="text-[11px] font-bold mt-1 break-words">{x.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <p className="text-base leading-8 break-words text-left sm:text-center">{p.text}</p>

          <div className="flex items-center justify-between gap-2 pt-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="px-4 py-2 rounded-full bg-[#1E3F20] text-[#D4AF37] text-xs font-bold disabled:opacity-30">← আগের পাতা</button>
            <span className="text-xs font-bold text-[#8a6d1d]">{toBn(page + 1)}/{toBn(pages.length)}</span>
            <button type="button" disabled={page >= pages.length - 1} onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-full bg-[#1E3F20] text-[#D4AF37] text-xs font-bold disabled:opacity-30">পরের পাতা →</button>
          </div>
          {canSpeak && (
            <button type="button" onClick={read} className="text-[11px] font-bold px-4 py-2 rounded-full bg-[#D4AF37] text-black">{speaking ? '⏹ থামাও' : '🔊 পড়ে শোনাও'}</button>
          )}
          {canSpeak && <p className="text-[10px] text-[#5b4a1a]">ফোনে বাংলা কণ্ঠ না থাকলে পড়ে শোনানো কাজ নাও করতে পারে।</p>}
        </div>
      )}
      {!p && <p className="text-xs text-gray-400 text-center py-6">উপরে একজনকে বেছে নিলেই গল্প শুরু হবে।</p>}
    </div>
  );
}
