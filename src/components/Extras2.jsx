import { useState, useEffect } from 'react';
import { makeGender } from '@/lib/relations';
import { rpc } from '@/lib/supabase';
import { getLang, setLang, onLangChange } from '@/lib/i18n';

const inputCls = 'w-full border rounded-xl p-3 bg-transparent text-xs border-gray-300 dark:border-white/10';
const PLACEHOLDER_DOB = '1995-01-01';

// ---------- Language switch ----------
export function LangToggle() {
  const [lang, setL] = useState(getLang());
  useEffect(() => onLangChange(setL), []);
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
      className="fixed bottom-3 left-3 z-[60] print:hidden bg-[#1E3F20] text-[#D4AF37] border border-[#D4AF37]/60 rounded-full px-3 py-2 text-[11px] font-bold shadow-lg"
      title="Language / ভাষা"
    >
      🌐 {lang === 'en' ? 'বাংলা' : 'English'}
    </button>
  );
}

// ---------- Statistics ----------
const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 shrink-0 truncate" title={r.label}>{r.label}</span>
          <div className="flex-1 h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right font-bold">{toBn(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

const top = (list, n = 5) => {
  const counts = {};
  for (const v of list) { const k = String(v || '').trim(); if (k) counts[k] = (counts[k] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
};

export function StatsPanel({ members }) {
  const gender = makeGender(members);
  const byId = {};
  members.forEach(m => { byId[m.id] = m; });
  const memo = {};
  const depth = (m, guard = 0) => {
    if (memo[m.id] !== undefined) return memo[m.id];
    if (guard > 12) return 0;
    const ps = [byId[m.fatherId], byId[m.motherId]].filter(Boolean);
    const d = ps.length ? 1 + Math.max(...ps.map(p => depth(p, guard + 1))) : 0;
    memo[m.id] = d;
    return d;
  };
  const gens = members.length ? Math.max(...members.map(m => depth(m))) + 1 : 0;
  const alive = members.filter(m => !m.isDeceased);
  const male = members.filter(m => gender(m) === 'male').length;
  const female = members.filter(m => gender(m) === 'female').length;
  const now = new Date();
  const age = (m) => {
    if (!m.dob || m.dob === PLACEHOLDER_DOB || !/^\d{4}-\d{2}-\d{2}/.test(m.dob)) return null;
    const d = new Date(m.dob);
    let a = now.getFullYear() - d.getFullYear();
    if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
    return a >= 0 && a < 120 ? a : null;
  };
  const ages = alive.map(age).filter(a => a !== null);
  const groups = [
    { label: 'শিশু ও কিশোর (০-১৭)', value: ages.filter(a => a < 18).length },
    { label: 'তরুণ (১৮-৩৫)', value: ages.filter(a => a >= 18 && a <= 35).length },
    { label: 'মধ্যবয়সী (৩৬-৫৯)', value: ages.filter(a => a >= 36 && a <= 59).length },
    { label: 'প্রবীণ (৬০+)', value: ages.filter(a => a >= 60).length },
  ];
  const prof = top(alive.map(m => m.profession));
  const place = top(alive.map(m => m.pob));
  const tile = (n, label) => (
    <div className="p-3 rounded-xl bg-emerald-500/10 text-center">
      <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{toBn(n)}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-300">{label}</p>
    </div>
  );
  return (
    <div className="p-4 rounded-2xl border bg-white/70 dark:bg-white/5 border-gray-200 dark:border-white/10 space-y-4">
      <h3 className="font-bold text-sm">📊 পরিবারের পরিসংখ্যান</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {tile(members.length, 'মোট সদস্য')}
        {tile(alive.length, 'জীবিত সদস্য')}
        {tile(members.length - alive.length, 'মরহুম সদস্য')}
        {tile(gens, 'প্রজন্ম')}
        {tile(male, 'পুরুষ')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">বয়স অনুযায়ী ভাগ ({toBn(ages.length)} জনের তথ্য)</p><Bars rows={groups} /></div>
        <div className="space-y-4">
          {prof.length > 0 && <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">পেশা</p><Bars rows={prof} /></div>}
          {place.length > 0 && <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">এলাকা</p><Bars rows={place} /></div>}
        </div>
      </div>
      {female > 0 && <p className="text-[11px] text-gray-400">নারী সদস্য: {toBn(female)} জন</p>}
    </div>
  );
}

// ---------- Contact buttons ----------
export function ContactButtons({ phone }) {
  const raw = String(phone || '');
  let digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.startsWith('01') && digits.length === 11) digits = '88' + digits;
  const tel = (raw.trim().startsWith('+') ? '+' : '') + raw.replace(/[^\d]/g, '');
  const cls = 'flex-1 text-center text-[11px] font-bold px-3 py-2 rounded-xl';
  return (
    <div className="flex gap-2 mt-3">
      <a href={`tel:${tel}`} className={`${cls} bg-emerald-600 text-white`}>📞 কল</a>
      <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={`${cls} bg-green-500 text-white`}>💬 হোয়াটসঅ্যাপ</a>
      <a href={`sms:${tel}`} className={`${cls} bg-blue-500 text-white`}>✉️ এসএমএস</a>
    </div>
  );
}

// ---------- Correction request ----------
export function CorrectionForm({ member }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full text-[11px] font-bold px-3 py-2 rounded-xl border border-emerald-600/40 text-emerald-700 dark:text-emerald-300">✏️ তথ্য সংশোধনের অনুরোধ</button>;
  }
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const p = { targetId: member.id, requestedBy: f.get('requestedBy') || '' };
    for (const k of ['phone', 'profession', 'education', 'address', 'pob', 'bio', 'dob', 'marriageDate']) p[k] = f.get(k) || '';
    setBusy(true); setMsg('');
    try {
      await rpc('submit_correction_request', { p });
      form.reset();
      setMsg('✅ অনুরোধ পাঠানো হয়েছে। অ্যাডমিন অনুমোদন দিলে তথ্য বদলাবে।');
    } catch (err) {
      setMsg('❌ ' + (String(err.message).includes('nothing to change') ? 'কোনো তথ্য লেখা হয়নি।' : 'পাঠানো যায়নি: ' + (err.message || 'ত্রুটি')));
    } finally { setBusy(false); }
  };
  const field = (name, label, type = 'text') => (
    <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{label}</label><input name={name} type={type} className={inputCls} /></div>
  );
  return (
    <form onSubmit={submit} className="mt-4 p-3 rounded-xl border border-emerald-600/30 space-y-2" onClick={e => e.stopPropagation()}>
      <p className="text-[11px] text-gray-400">যে তথ্য বদলাতে চান শুধু সেগুলো লিখুন। অ্যাডমিন অনুমোদন দিলে বদলাবে।</p>
      <div className="grid grid-cols-2 gap-2">
        {field('phone', 'মোবাইল')}{field('profession', 'পেশা')}{field('education', 'শিক্ষা')}{field('address', 'ঠিকানা')}
        {field('pob', 'জন্মস্থান / জেলা')}{field('dob', 'জন্ম তারিখ', 'date')}{field('marriageDate', 'বিবাহের তারিখ', 'date')}
        {field('requestedBy', 'আপনার নাম (অনুরোধকারী)')}
      </div>
      <textarea name="bio" rows="2" placeholder="জীবনী (নতুন)" className={inputCls} />
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 bg-emerald-600 disabled:opacity-60 text-white font-bold text-xs py-2.5 rounded-xl">{busy ? 'পাঠানো হচ্ছে...' : 'সংশোধনের অনুরোধ পাঠান'}</button>
        <button type="button" onClick={() => { setOpen(false); setMsg(''); }} className="px-4 text-xs font-bold rounded-xl bg-black/10 dark:bg-white/10">বাতিল</button>
      </div>
      {msg && <p className="text-xs font-bold break-words">{msg}</p>}
    </form>
  );
}

// ---------- Announcements (pinned events) ----------
export function Announcements({ events }) {
  const list = events.filter(e => e.pinned).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className="p-4 rounded-2xl border-2 border-[#D4AF37]/60 bg-amber-50 dark:bg-[#D4AF37]/10 space-y-3">
      <h3 className="font-bold text-sm">📢 পারিবারিক ঘোষণা</h3>
      {list.map(e => (
        <div key={e.id} className="text-xs">
          <p className="font-bold">{e.icon || '📌'} {e.title} <span className="text-gray-400 font-normal">· {e.date}</span></p>
          <p className="text-gray-600 dark:text-gray-300 mt-0.5 break-words">{e.description}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Remembrance page ----------
function DuaBox({ member, defaultName }) {
  const [local, setLocal] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const all = [...(member.duas || []), ...local];
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get('name') || '').trim();
    const text = String(f.get('text') || '').trim();
    if (!text) return;
    setBusy(true); setMsg('');
    try {
      await rpc('add_dua', { p_member: member.id, p_name: name, p_text: text });
      setLocal(prev => [...prev, { name: name || 'পরিবারের সদস্য', text, at: new Date().toISOString().slice(0, 10) }]);
      form.reset();
    } catch (err) { setMsg('❌ লেখা যায়নি: ' + (err.message || 'ত্রুটি')); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase">দোয়া ও স্মৃতি</p>
      {all.length === 0 && <p className="text-[11px] text-gray-400">এখনো কোনো দোয়া লেখা হয়নি।</p>}
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {all.map((d, i) => (
          <div key={i} className="text-[11px] p-2 rounded-lg bg-black/5 dark:bg-white/5 break-words">
            <span>{d.text}</span>
            <span className="block text-[9px] text-gray-400 mt-0.5">— {d.name} · {d.at}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input name="name" defaultValue={defaultName || ''} maxLength={60} placeholder="আপনার নাম" className={inputCls} />
        <textarea name="text" required rows="2" maxLength={300} placeholder="দোয়া লিখুন..." className={inputCls} />
        <button disabled={busy} className="bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs py-2 rounded-xl">{busy ? 'পাঠানো হচ্ছে...' : 'পাঠান'}</button>
        {msg && <p className="text-[11px] font-bold">{msg}</p>}
      </form>
    </div>
  );
}

export function MemorialPage({ members, onSelect, defaultName }) {
  const late = members.filter(m => m.isDeceased);
  const fmt = (s) => { if (!s) return ''; try { return new Date(s).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return s; } };
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold">🕯️ স্মরণ ও দোয়া</h2>
        <p className="text-xs text-gray-400 mt-1">মরহুম সদস্যদের স্মরণে। দোয়া লিখে রাখুন, পরিবারের সবাই দেখতে পাবে।</p>
      </div>
      {late.length === 0 && <p className="text-center text-xs text-gray-400 py-8">কোনো মরহুম সদস্য নেই।</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {late.map(m => (
          <div key={m.id} className="p-4 rounded-2xl border bg-white/70 dark:bg-white/5 border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <img src={m.avatar} alt={m.name} className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37] grayscale" />
              <div className="min-w-0">
                <button type="button" onClick={() => onSelect(m)} className="font-bold text-sm text-left break-words">{m.name}</button>
                <p className="text-[11px] text-gray-500">
                  {m.dob && m.dob !== PLACEHOLDER_DOB ? fmt(m.dob) : '—'} – {m.deathDate ? fmt(m.deathDate) : '—'}
                </p>
                {m.burialPlace && <p className="text-[11px] text-gray-500">⚰️ কবরের স্থান: {m.burialPlace}</p>}
              </div>
            </div>
            {m.bio && <p className="text-xs italic text-gray-500 dark:text-gray-300 mt-3 break-words">{m.bio}</p>}
            <DuaBox member={m} defaultName={defaultName} />
          </div>
        ))}
      </div>
    </div>
  );
}
