import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { relationTerm } from '@/lib/relations';

const inputCls = 'w-full border rounded-xl p-3 bg-transparent text-xs border-gray-300 dark:border-white/10';
const VAPID_PUBLIC_KEY = 'BKcn6R7AbTARy0Zdfsq-dJPhk9oHQQ12Sotfi-45vP-A9MdrUU5N9htI5_y0ToB2o7gZGWSS_r9obNiqNMnGgAM';
const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);

// ---------- dates (the family lives on Bangladesh time) ----------
const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const dayNumber = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
const daysUntil = (iso) => dayNumber(iso) - dayNumber(todayDhaka());
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
import { knownDob } from '@/lib/placeholders';
const birthdayDate = (dob, years) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || '')) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const ty = y + Number(years);
  const day = m === 2 && d === 29 && !isLeap(ty) ? 28 : d;
  return `${ty}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
const bnDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  return `${toBn(d)} ${months[m - 1]} ${toBn(y)}`;
};
const countdownText = (iso) => {
  const n = daysUntil(iso);
  if (n <= 0) return 'আজ খুলবে';
  if (n < 60) return `আর ${toBn(n)} দিন বাকি`;
  const years = Math.floor(n / 365);
  const months = Math.floor((n % 365) / 30);
  return `আর প্রায় ${years ? `${toBn(years)} বছর ` : ''}${months ? `${toBn(months)} মাস` : ''}`.trim() + ' বাকি';
};

// ---------- phone notifications ----------
const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

const getRegistration = () => withTimeout(
  navigator.serviceWorker.ready, 5000,
  'সাইটের সার্ভিস এখনো চালু হয়নি। পাতাটি একবার রিফ্রেশ করে আবার চেষ্টা করুন।',
);

const pushSupported = () => typeof window !== 'undefined'
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export function NotifyPanel({ members }) {
  const [me, setMe] = useState(() => { try { return localStorage.getItem('family_me_v1') || ''; } catch { return ''; } });
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const supported = pushSupported();

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    getRegistration().then(r => r.pushManager.getSubscription()).then(s => { if (alive) setOn(!!s); }).catch(() => {});
    return () => { alive = false; };
  }, [supported]);

  const chooseMe = (id) => {
    setMe(id);
    try { localStorage.setItem('family_me_v1', id); } catch { /* ignore */ }
  };

  const enable = async () => {
    setBusy(true); setMsg('');
    try {
      if (!me) throw new Error('আগে "এই ফোনটি কার?" বেছে নিন, নইলে আপনার জন্য রাখা চিঠির খবর পাঠানো যাবে না।');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('নোটিফিকেশনের অনুমতি দেওয়া হয়নি। ব্রাউজার বা ফোনের সেটিংস থেকে এই সাইটের নোটিফিকেশন চালু করুন।');
      const reg = await getRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
      const j = sub.toJSON();
      await rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_member: me });
      setOn(true);
      setMsg('✅ এই ফোনে নোটিফিকেশন চালু হয়েছে।');
    } catch (e) {
      setMsg(`❌ ${e.message || e}`);
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMsg('');
    try {
      const reg = await getRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { await rpc('remove_push_subscription', { p_endpoint: sub.endpoint }); } catch { /* the server cleans dead ones by itself */ }
        await sub.unsubscribe();
      }
      setOn(false);
      setMsg('এই ফোনে নোটিফিকেশন বন্ধ করা হয়েছে।');
    } catch (e) {
      setMsg(`❌ ${e.message || e}`);
    } finally { setBusy(false); }
  };

  const test = async () => {
    setMsg('');
    try {
      const reg = await getRegistration();
      await reg.showNotification('⏳ পরীক্ষামূলক নোটিফিকেশন', { body: 'এভাবেই টাইম ক্যাপসুল খোলার খবর আসবে।', icon: './icon-192.png' });
    } catch (e) { setMsg(`❌ ${e.message || e}`); }
  };

  return (
    <div className="p-4 rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 space-y-3">
      <h3 className="font-bold text-sm">🔔 ফোনে নোটিফিকেশন</h3>
      {!supported ? (
        <p className="text-[11px] text-gray-500">এই ব্রাউজারে নোটিফিকেশন চলে না। ফোনে Chrome বা Safari (হোম স্ক্রিনে যোগ করা) ব্যবহার করুন।</p>
      ) : (
        <>
          {isIos() && !isStandalone() && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
              আইফোনে নোটিফিকেশন পেতে আগে Safari-র শেয়ার বোতাম থেকে "Add to Home Screen" দিয়ে সাইটটি হোম স্ক্রিনে যোগ করুন, তারপর সেই আইকন থেকে খুলে এখানে চালু করুন।
            </p>
          )}
          <div>
            <label className="block text-[10px] text-gray-400 font-bold mb-1">এই ফোনটি কার?</label>
            <select value={me} onChange={e => chooseMe(e.target.value)} className={inputCls} disabled={on}>
              <option value="">বেছে নিন</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            {on ? (
              <>
                <button type="button" disabled={busy} onClick={disable} className="text-[11px] font-bold px-4 py-2 rounded-full bg-black/20 dark:bg-white/10">বন্ধ করুন</button>
                <button type="button" onClick={test} className="text-[11px] font-bold px-4 py-2 rounded-full bg-emerald-700 text-white">পরীক্ষা করুন</button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={enable} className="text-[11px] font-bold px-4 py-2 rounded-full bg-[#D4AF37] text-black">
                {busy ? 'অপেক্ষা করুন…' : 'এই ফোনে চালু করুন'}
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400">চিঠির দিন এলে সকাল ৮টার দিকে খবর আসবে। সাইট খোলা না থাকলেও আসবে।</p>
        </>
      )}
      {msg && <p className="text-[11px] font-bold break-words">{msg}</p>}
    </div>
  );
}

// ---------- time capsules ----------
function useCapsules() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const reload = async () => {
    try { setList(await rpc('list_capsules')); setError(''); }
    catch (e) { setError(e.message || String(e)); setList([]); }
  };
  useEffect(() => { reload(); }, []);
  return { list, error, reload };
}

const emptyForm = (author) => ({
  title: '', author, body: '', kind: 'date', openOn: '', memberId: '', years: '18', everyone: true, recipients: [],
});

function CapsuleForm({ members, defaultAuthor, onDone, onCancel }) {
  const [f, setF] = useState(() => emptyForm(defaultAuthor || ''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const target = members.find(m => m.id === f.memberId);
  const birthday = f.kind === 'birthday' && target ? birthdayDate(knownDob(target), f.years) : null;
  const opens = f.kind === 'date' ? f.openOn : birthday;
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

  // Choosing "on someone's birthday" also picks that person as the reader, which is what people usually mean.
  const pickMember = (id) => setF(prev => ({ ...prev, memberId: id, everyone: false, recipients: id ? [id] : [] }));
  const toggleRecipient = (id) => setF(prev => ({
    ...prev,
    recipients: prev.recipients.includes(id) ? prev.recipients.filter(x => x !== id) : [...prev.recipients, id],
  }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!opens) return setErr(f.kind === 'birthday' && target ? `${target.name}-এর জন্মতারিখ প্রোফাইলে দেওয়া নেই, তাই জন্মদিন ধরে তালা দেওয়া যাবে না।` : 'খোলার তারিখ ঠিক করুন।');
    if (daysUntil(opens) <= 0) return setErr('খোলার তারিখ অবশ্যই ভবিষ্যতের হতে হবে।');
    if (!f.everyone && f.recipients.length === 0) return setErr('কাকে চিঠিটি পাঠাচ্ছেন বেছে নিন, অথবা "পুরো পরিবার" রাখুন।');
    if (!window.confirm(`চিঠিটি ${bnDate(opens)} পর্যন্ত তালাবদ্ধ থাকবে। তালা দেওয়ার পর কেউ আগে পড়তে পারবে না, আপনিও না। তালা দেবেন?`)) return;
    setBusy(true);
    try {
      await rpc('create_capsule', {
        p: {
          title: f.title, author: f.author, body: f.body, kind: f.kind,
          openOn: f.kind === 'date' ? f.openOn : undefined,
          memberId: f.kind === 'birthday' ? f.memberId : undefined,
          years: f.kind === 'birthday' ? Number(f.years) : undefined,
          recipients: f.everyone ? [] : f.recipients,
        },
      });
      onDone();
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="p-4 rounded-2xl border border-[#D4AF37]/50 space-y-3 text-xs">
      <h3 className="font-bold text-sm">✍️ নতুন চিঠি লিখুন</h3>
      <div>
        <label className="block text-[10px] text-gray-400 font-bold mb-1">চিঠির শিরোনাম *</label>
        <input required maxLength={100} value={f.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="যেমন: আঠারো বছরে পা দেওয়ার দিনে" />
      </div>
      <div>
        <label className="block text-[10px] text-gray-400 font-bold mb-1">কার পক্ষ থেকে *</label>
        <input required maxLength={60} value={f.author} onChange={e => set('author', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-[10px] text-gray-400 font-bold mb-1">চিঠি *</label>
        <textarea required rows={7} maxLength={5000} value={f.body} onChange={e => set('body', e.target.value)} className={inputCls} placeholder="ভবিষ্যতের কারও জন্য আপনার কথা…" />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-gray-400 font-bold">কখন খুলবে?</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => set('kind', 'date')} className={`px-3 py-1.5 rounded-full font-bold ${f.kind === 'date' ? 'bg-[#D4AF37] text-black' : 'bg-black/10 dark:bg-white/10'}`}>নির্দিষ্ট তারিখে</button>
          <button type="button" onClick={() => set('kind', 'birthday')} className={`px-3 py-1.5 rounded-full font-bold ${f.kind === 'birthday' ? 'bg-[#D4AF37] text-black' : 'bg-black/10 dark:bg-white/10'}`}>কারও জন্মদিনে</button>
        </div>
        {f.kind === 'date' ? (
          <input type="date" required min={tomorrow} value={f.openOn} onChange={e => set('openOn', e.target.value)} className={inputCls} />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <select required value={f.memberId} onChange={e => pickMember(e.target.value)} className={`${inputCls} col-span-2`}>
              <option value="">কার জন্মদিন?</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <input type="number" min={1} max={100} required value={f.years} onChange={e => set('years', e.target.value)} className={inputCls} />
              <span className="text-[10px] font-bold whitespace-nowrap">তম</span>
            </div>
          </div>
        )}
        {opens && <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">🔒 খুলবে: {bnDate(opens)} ({countdownText(opens)})</p>}
        {f.kind === 'birthday' && target && !birthday && (
          <p className="text-[11px] font-bold text-red-500">{target.name}-এর জন্মতারিখ প্রোফাইলে নেই। আগে সেটি যোগ করুন।</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-gray-400 font-bold">কে পড়বে? (নোটিফিকেশন তাঁদের ফোনে যাবে)</p>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={f.everyone} onChange={e => set('everyone', e.target.checked)} /> পুরো পরিবার
        </label>
        {!f.everyone && (
          <div className="max-h-40 overflow-y-auto border rounded-xl p-2 border-gray-300 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-1">
            {members.map(m => (
              <label key={m.id} className="flex items-center gap-2">
                <input type="checkbox" checked={f.recipients.includes(m.id)} onChange={() => toggleRecipient(m.id)} /> {m.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {err && <p className="text-[11px] font-bold text-red-500 break-words">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-[#1E3F20] text-[#D4AF37] font-bold">{busy ? 'তালা দেওয়া হচ্ছে…' : '🔒 তালা দিয়ে রাখুন'}</button>
        <button type="button" onClick={onCancel} className="px-4 py-3 rounded-xl bg-black/10 dark:bg-white/10 font-bold">বাতিল</button>
      </div>
    </form>
  );
}

function CapsuleCard({ c, names, isAdmin, onDelete }) {
  const [open, setOpen] = useState(false);
  const who = !c.recipients || c.recipients.length === 0 ? 'পুরো পরিবার' : c.recipients.map(id => names[id] || 'সদস্য').join(', ');
  const occasion = c.kind === 'birthday' ? `${names[c.member_id] || 'সদস্য'}-এর ${toBn(c.years)}তম জন্মদিন` : null;
  return (
    <div className={`p-4 rounded-2xl border ${c.is_open ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-gray-300 dark:border-white/10 bg-black/5 dark:bg-white/5'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm break-words">{c.is_open ? '💌' : '🔒'} {c.title}</p>
          <p className="text-[11px] text-gray-500 break-words">{c.author_name}-এর পক্ষ থেকে · {who}-এর জন্য</p>
          {occasion && <p className="text-[10px] text-gray-400">{occasion}</p>}
        </div>
        {isAdmin && (
          <button type="button" onClick={() => onDelete(c)} className="text-[10px] font-bold text-red-500 shrink-0">মুছুন</button>
        )}
      </div>
      {c.is_open ? (
        <div className="mt-3">
          <p className="text-[10px] text-gray-400">খুলেছে: {bnDate(c.open_on)}</p>
          {open ? (
            <p className="mt-2 text-sm whitespace-pre-wrap break-words leading-relaxed">{c.body}</p>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[11px] font-bold px-4 py-2 rounded-full bg-[#D4AF37] text-black">চিঠি পড়ুন</button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] font-bold text-gray-500">
          {c.open_on ? `খুলবে ${bnDate(c.open_on)} · ${countdownText(c.open_on)}` : 'জন্মতারিখ যোগ হলে তারিখ ঠিক হবে'}
        </p>
      )}
    </div>
  );
}

export function CapsulePage({ members, isAdmin, defaultName }) {
  const { list, error, reload } = useCapsules();
  const [writing, setWriting] = useState(false);
  const names = useMemo(() => Object.fromEntries(members.map(m => [m.id, m.name])), [members]);

  const remove = async (c) => {
    if (!window.confirm(`"${c.title}" চিঠিটি চিরতরে মুছে ফেলবেন?`)) return;
    try { await rpc('delete_capsule', { p_id: c.id }); reload(); }
    catch (e) { window.alert(`মুছতে পারিনি: ${e.message || e}`); }
  };

  const opened = (list || []).filter(c => c.is_open).sort((a, b) => String(b.open_on).localeCompare(String(a.open_on)));
  const locked = (list || []).filter(c => !c.is_open);

  return (
    <div className="space-y-4">
      <div className="text-center border-b pb-4">
        <h2 className="text-lg font-bold">⏳ টাইম ক্যাপসুল</h2>
        <p className="text-xs text-gray-400 mt-1">ভবিষ্যতের কারও জন্য আজই চিঠি লিখে রাখুন। নির্ধারিত দিনের আগে কেউ খুলতে পারবে না।</p>
      </div>

      {!writing && (
        <button type="button" onClick={() => setWriting(true)} className="w-full py-3 rounded-xl bg-[#1E3F20] text-[#D4AF37] font-bold text-sm">✍️ নতুন চিঠি লিখুন</button>
      )}
      {writing && (
        <CapsuleForm members={members} defaultAuthor={defaultName} onCancel={() => setWriting(false)} onDone={() => { setWriting(false); reload(); }} />
      )}

      <NotifyPanel members={members} />

      {error && <p className="text-[11px] font-bold text-red-500 break-words">চিঠির তালিকা আনতে সমস্যা: {error}</p>}
      {list === null && <p className="text-xs text-gray-400 text-center">লোড হচ্ছে…</p>}

      {opened.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm">💌 খুলে গেছে</h3>
          {opened.map(c => <CapsuleCard key={c.id} c={c} names={names} isAdmin={isAdmin} onDelete={remove} />)}
        </div>
      )}
      {locked.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm">🔒 তালাবদ্ধ ({toBn(locked.length)})</h3>
          {locked.map(c => <CapsuleCard key={c.id} c={c} names={names} isAdmin={isAdmin} onDelete={remove} />)}
        </div>
      )}
      {list && list.length === 0 && !error && (
        <p className="text-xs text-gray-400 text-center py-6">এখনো কোনো চিঠি রাখা হয়নি। প্রথম চিঠিটি আপনিই লিখুন।</p>
      )}
    </div>
  );
}

// A small card on the home page for letters that opened during the last 30 days.
export function CapsuleBanner({ onOpen }) {
  const { list } = useCapsules();
  const fresh = (list || []).filter(c => c.is_open && c.open_on && daysUntil(c.open_on) >= -30);
  if (fresh.length === 0) return null;
  return (
    <button type="button" onClick={onOpen} className="w-full text-left p-4 rounded-2xl border-2 border-[#D4AF37] bg-[#D4AF37]/10">
      <p className="font-bold text-sm">⏳ {toBn(fresh.length)}টি টাইম ক্যাপসুল খুলেছে</p>
      <p className="text-[11px] text-gray-500 break-words">{fresh.slice(0, 2).map(c => `${c.author_name}-এর "${c.title}"`).join(' · ')}</p>
      <p className="text-[11px] font-bold text-amber-600 mt-1">পড়তে চাপ দিন →</p>
    </button>
  );
}

// ---------- "through their eyes" mode for the family tree ----------
export const PerspectiveContext = createContext({ viewer: null, term: () => '', direct: null });

const shortTerm = (t) => (!t ? '' : t.startsWith('সম্পর্ক নির্ণয়') ? 'সম্পর্ক জানা নেই' : t);

// People closest to the viewer: spouse, parents, grandparents, brothers and sisters, children and grandchildren.
function directFamily(viewer, members) {
  const byId = new Map(members.map(m => [m.id, m]));
  const set = new Set([viewer.id]);
  const add = (id) => { if (id && byId.has(id)) set.add(id); };
  const spouse = byId.get(viewer.spouseId) || members.find(o => o.spouseId === viewer.id);
  if (spouse) set.add(spouse.id);
  [viewer.fatherId, viewer.motherId].forEach(pid => {
    add(pid);
    const p = byId.get(pid);
    if (p) { add(p.fatherId); add(p.motherId); }
  });
  members.forEach(o => {
    const shareParent = (viewer.fatherId && o.fatherId === viewer.fatherId) || (viewer.motherId && o.motherId === viewer.motherId);
    if (shareParent) set.add(o.id);
    if (o.fatherId === viewer.id || o.motherId === viewer.id) {
      set.add(o.id);
      if (o.spouseId) add(o.spouseId);
      members.forEach(g => { if (g.fatherId === o.id || g.motherId === o.id) set.add(g.id); });
    }
  });
  return set;
}

export function usePerspective(members) {
  const [viewerId, setViewerId] = useState('');
  const [directOnly, setDirectOnly] = useState(false);
  const viewer = members.find(m => m.id === viewerId) || null;
  const value = useMemo(() => {
    if (!viewer) return { viewer: null, term: () => '', direct: null };
    const cache = new Map();
    return {
      viewer,
      term: (m) => {
        if (!cache.has(m.id)) cache.set(m.id, shortTerm(relationTerm(viewer, m, members)));
        return cache.get(m.id);
      },
      direct: directOnly ? directFamily(viewer, members) : null,
    };
  }, [viewer, members, directOnly]);
  return { viewerId, setViewerId, directOnly, setDirectOnly, value };
}

export function PerspectiveBar({ members, viewerId, setViewerId, directOnly, setDirectOnly }) {
  const saved = (() => { try { return localStorage.getItem('family_me_v1') || ''; } catch { return ''; } })();
  const hasSaved = saved && members.some(m => m.id === saved);
  return (
    <div className="p-4 rounded-2xl border bg-white/70 dark:bg-white/5 border-gray-200 dark:border-white/10 space-y-3">
      <h3 className="font-bold text-sm">👁️ তাঁর চোখে দেখুন</h3>
      <div className="flex gap-2 flex-wrap items-center">
        <select value={viewerId} onChange={e => setViewerId(e.target.value)} className={`${inputCls} flex-1 min-w-[10rem]`}>
          <option value="">সাধারণ গাছ</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}-এর চোখে</option>)}
        </select>
        {hasSaved && viewerId !== saved && (
          <button type="button" onClick={() => setViewerId(saved)} className="text-[11px] font-bold px-3 py-2 rounded-full bg-[#D4AF37] text-black whitespace-nowrap">আমার চোখে</button>
        )}
      </div>
      {viewerId && (
        <>
          <label className="flex items-center gap-2 text-[11px] font-bold">
            <input type="checkbox" checked={directOnly} onChange={e => setDirectOnly(e.target.checked)} />
            শুধু কাছের আত্মীয় উজ্জ্বল করুন (বাবা-মা, দাদা-দাদি, ভাইবোন, সঙ্গী, সন্তান, নাতি-নাতনি)
          </label>
          <p className="text-[10px] text-gray-400">প্রতিটি কার্ডে লেখা সম্পর্ক এই মানুষটির সঙ্গে। সম্পর্ক ঠিক আসার জন্য গাছে বাবা-মা ও সঙ্গীর যোগ থাকা দরকার।</p>
        </>
      )}
    </div>
  );
}
