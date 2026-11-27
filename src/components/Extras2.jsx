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

// ---------- Statistics: "tree rings" ----------
// Each generation is one ring around the centre, like the growth rings of a tree.
const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);

const top = (list, n = 6) => {
  const counts = {};
  for (const v of list) { const k = String(v || '').trim(); if (k) counts[k] = (counts[k] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
};

function TreeRings({ perGen, total }) {
  const size = 190;
  const c = size / 2;
  const rings = perGen.length;
  const step = rings > 1 ? Math.min(15, (c - 34) / rings) : 15;
  const maxCount = Math.max(1, ...perGen);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-44 h-44 shrink-0" role="img" aria-label="প্রজন্ম অনুযায়ী সদস্য">
      {perGen.map((count, i) => {
        const r = 30 + (rings - 1 - i) * step + step / 2; // oldest generation in the middle
        const w = 3 + (count / maxCount) * (step - 5);
        return (
          <g key={i}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="#D4AF37" strokeOpacity={0.25 + 0.75 * ((i + 1) / rings)} strokeWidth={w} strokeDasharray={i % 2 ? '2 3' : undefined} />
          </g>
        );
      })}
      <circle cx={c} cy={c} r="26" fill="#0b1f0d" stroke="#D4AF37" strokeWidth="1.5" />
      <text x={c} y={c + 4} textAnchor="middle" fontSize="16" fontWeight="800" fill="#F3E3A0">{toBn(total)}</text>
    </svg>
  );
}

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
  const perGen = Array.from({ length: gens }, (_, g) => members.filter(m => depth(m) === g).length);
  const alive = members.filter(m => !m.isDeceased);
  const late = members.length - alive.length;
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
    { label: '০-১৭', note: 'শিশু ও কিশোর (০-১৭)', value: ages.filter(a => a < 18).length },
    { label: '১৮-৩৫', note: 'তরুণ (১৮-৩৫)', value: ages.filter(a => a >= 18 && a <= 35).length },
    { label: '৩৬-৫৯', note: 'মধ্যবয়সী (৩৬-৫৯)', value: ages.filter(a => a >= 36 && a <= 59).length },
    { label: '৬০+', note: 'প্রবীণ (৬০+)', value: ages.filter(a => a >= 60).length },
  ];
  const gmax = Math.max(1, ...groups.map(g => g.value));
  const prof = top(alive.map(m => m.profession));
  const place = top(alive.map(m => m.pob || m.address));
  const pct = members.length ? Math.round((alive.length / members.length) * 100) : 0;

  const chip = (k, text) => (
    <span key={k} className="inline-block text-[11px] font-bold px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white/5 text-[#F3E3A0]">{text}</span>
  );

  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white bg-gradient-to-br from-[#1E3F20] via-[#163018] to-[#0b1f0d] border border-[#D4AF37]/40 shadow-lg">
      <div className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full border-[14px] border-[#D4AF37]/10" />
      <div className="pointer-events-none absolute -right-8 -top-8 w-40 h-40 rounded-full border-[8px] border-[#D4AF37]/10" />
      <p className="text-[10px] tracking-widest text-[#D4AF37] font-bold">বৃক্ষবলয় · পরিবারের পরিসংখ্যান</p>
      <h3 className="font-bold text-sm mt-1">📊 পরিবারের পরিসংখ্যান</h3>

      <div className="mt-4 flex flex-col sm:flex-row items-center gap-5">
        <TreeRings perGen={perGen} total={members.length} />
        <div className="flex-1 w-full space-y-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span>জীবিত সদস্য {toBn(alive.length)}</span>
              <span>মরহুম সদস্য {toBn(late)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E3A0]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {chip('g', `প্রজন্ম ${toBn(gens)}`)}
            {male > 0 && chip('m', `পুরুষ ${toBn(male)}`)}
            {female > 0 && chip('f', `নারী ${toBn(female)}`)}
          </div>
          {perGen.length > 0 && (
            <ol className="text-[10px] text-white/70 space-y-0.5">
              {perGen.map((n, i) => <li key={i}>{toBn(i + 1)}ম বলয় (প্রজন্ম {toBn(i + 1)}): {toBn(n)} জন</li>)}
            </ol>
          )}
        </div>
      </div>

      {ages.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-bold text-[#D4AF37] mb-2">বয়সের ভাগ ({toBn(ages.length)} জনের তথ্য)</p>
          <div className="flex items-end gap-3 h-24">
            {groups.map(g => (
              <div key={g.label} className="flex-1 flex flex-col items-center justify-end h-full" title={g.note}>
                <span className="text-[10px] font-bold mb-1">{toBn(g.value)}</span>
                <div className="w-full rounded-t-xl bg-gradient-to-t from-[#2f8f4e] to-[#8ad49f]" style={{ height: `${Math.max(6, (g.value / gmax) * 70)}%` }} />
                <span className="text-[10px] text-white/70 mt-1">{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(prof.length > 0 || place.length > 0) && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prof.length > 0 && (
            <div><p className="text-[10px] font-bold text-[#D4AF37] mb-2">পেশা</p>
              <div className="flex flex-wrap gap-1.5">{prof.map(r => chip(r.label, `${r.label} ×${toBn(r.value)}`))}</div></div>
          )}
          {place.length > 0 && (
            <div><p className="text-[10px] font-bold text-[#D4AF37] mb-2">এলাকা</p>
              <div className="flex flex-wrap gap-1.5">{place.map(r => chip(r.label, `${r.label} ×${toBn(r.value)}`))}</div></div>
          )}
        </div>
      )}
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
