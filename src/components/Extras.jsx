import { useState, useEffect } from 'react';
import { relationTerm } from '@/lib/relations';
import { upcomingEvents, bnDate } from '@/lib/dates';
import { rpc } from '@/lib/supabase';

const inputCls = 'w-full border rounded-xl p-3 bg-transparent text-xs border-gray-300 dark:border-white/10';

// ---------- Birthdays and anniversaries ----------
export function UpcomingPanel({ members, onSelect }) {
  const list = upcomingEvents(members, 45).slice(0, 8);
  if (!list.length) return null;
  return (
    <div className="p-4 rounded-2xl border bg-white/70 dark:bg-white/5 border-gray-200 dark:border-white/10">
      <h3 className="font-bold text-sm mb-3">🎂 আসন্ন জন্মদিন ও বিবাহবার্ষিকী</h3>
      <div className="space-y-2">
        {list.map((e, i) => (
          <button key={i} type="button" onClick={() => onSelect(e.member)} className="w-full flex items-center gap-3 text-left rounded-xl px-3 py-2 hover:bg-emerald-500/10">
            <span className="text-xl">{e.kind === 'birthday' ? '🎂' : '💍'}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-bold break-words">
                {e.kind === 'birthday' ? e.member.name : `${e.member.name}${e.spouse ? ' ও ' + e.spouse.name : ''}`}
              </span>
              <span className="block text-[10px] text-gray-400">
                {bnDate(e.next)} · {e.kind === 'birthday' ? `${e.years} বছর পূর্ণ হবে` : `${e.years}তম বিবাহবার্ষিকী`}
              </span>
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#1E3F20] text-[#D4AF37] whitespace-nowrap">
              {e.days === 0 ? 'আজ!' : `${e.days} দিন বাকি`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Relationship finder ----------
export function RelationTool({ members }) {
  const [a, setA] = useState(() => { try { return localStorage.getItem('family_me_v1') || ''; } catch { return ''; } });
  const [b, setB] = useState('');
  useEffect(() => { try { if (a) localStorage.setItem('family_me_v1', a); } catch { /* ignore */ } }, [a]);
  const ma = members.find(m => m.id === a);
  const mb = members.find(m => m.id === b);
  const term = ma && mb ? relationTerm(ma, mb, members) : '';
  return (
    <div className="p-4 rounded-2xl border bg-white/70 dark:bg-white/5 border-gray-200 dark:border-white/10 space-y-3">
      <h3 className="font-bold text-sm">🔎 সম্পর্ক নির্ণয়</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-400 font-bold mb-1">আমি (বা প্রথম জন)</label>
          <select value={a} onChange={e => setA(e.target.value)} className={inputCls}>
            <option value="">বেছে নিন</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 font-bold mb-1">দ্বিতীয় জন</label>
          <select value={b} onChange={e => setB(e.target.value)} className={inputCls}>
            <option value="">বেছে নিন</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      {term && (
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 break-words">
          {mb.name} হলেন {ma.name}-এর <span className="text-[#D4AF37]">{term}</span>
        </p>
      )}
    </div>
  );
}

// ---------- Member checkbox picker (for tagging photos/events) ----------
export function MemberMultiSelect({ members, name = 'memberIds', defaultValue = [], label = 'যাদের ট্যাগ করবেন' }) {
  const [q, setQ] = useState('');
  const sel = new Set(defaultValue);
  return (
    <div>
      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{label}</label>
      <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="নাম খুঁজুন..." className={`${inputCls} mb-2`} />
      <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1 border-gray-300 dark:border-white/10">
        {members.map(m => (
          <label key={m.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${m.name.toLowerCase().includes(q.toLowerCase()) ? '' : 'hidden'}`}>
            <input type="checkbox" name={name} value={m.id} defaultChecked={sel.has(m.id)} />
            <span>{m.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------- Tagged members chips ----------
export function TaggedMembers({ ids = [], members, onSelect }) {
  const list = ids.map(id => members.find(m => m.id === id)).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {list.map(m => (
        <button key={m.id} type="button" onClick={() => onSelect && onSelect(m)} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          👤 {m.name}
        </button>
      ))}
    </div>
  );
}

// ---------- Photos and events tagged with a member (profile modal) ----------
export function MemberLinks({ member, gallery, events, members, onClose }) {
  const photos = gallery.filter(g => (g.memberIds || []).includes(member.id));
  const evs = events.filter(e => (e.memberIds || []).includes(member.id));
  if (!photos.length && !evs.length) return null;
  void members; void onClose;
  return (
    <div className="mt-4 space-y-3">
      {photos.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">📸 এঁর ছবি</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 9).map(p => <img key={p.id} src={p.url} alt={p.title} className="aspect-square w-full object-cover rounded-lg" />)}
          </div>
        </div>
      )}
      {evs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">📅 জড়িত ঘটনা</p>
          <ul className="space-y-1">
            {evs.map(e => <li key={e.id} className="text-xs">{e.icon || '📌'} {e.title} <span className="text-gray-400">({e.date})</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Member-facing request form ----------
export function RequestForm({ members, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg('');
    try {
      await rpc('submit_member_request', { p: {
        name: String(f.get('name') || '').trim(), bio: f.get('bio') || '', dob: f.get('dob') || '',
        marriageDate: f.get('marriageDate') || '', pob: f.get('pob') || '', education: f.get('education') || '',
        profession: f.get('profession') || '', phone: f.get('phone') || '', address: f.get('address') || '',
        role: f.get('role') || 'Child', fatherId: f.get('fatherId') || '', motherId: f.get('motherId') || '',
        spouseId: f.get('spouseId') || '', gender: f.get('gender') || '', requestedBy: String(f.get('requestedBy') || '').trim(),
      } });
      form.reset();
      setMsg('✅ অনুরোধ পাঠানো হয়েছে। অ্যাডমিন অনুমোদন দিলে সদস্য তালিকায় আসবে।');
      onDone && onDone();
    } catch (err) {
      setMsg('❌ পাঠানো যায়নি: ' + (err.message || 'ত্রুটি'));
    } finally { setBusy(false); }
  };
  const sel = (name, label) => (
    <div>
      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">{label}</label>
      <select name={name} className={inputCls}>
        <option value="">নেই / জানি না</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-gray-400">নতুন সদস্যের তথ্য এখানে পাঠান। অ্যাডমিন যাচাই করে অনুমোদন দিলে তবেই সাইটে দেখা যাবে।</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">সদস্যের নাম *</label><input required name="name" maxLength={100} className={inputCls} /></div>
        <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">আপনার নাম</label><input name="requestedBy" maxLength={100} className={inputCls} /></div>
        <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">লিঙ্গ</label>
          <select name="gender" className={inputCls}><option value="">বেছে নিন</option><option value="male">ছেলে / পুরুষ</option><option value="female">মেয়ে / নারী</option></select></div>
        <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">জন্ম তারিখ</label><input name="dob" type="date" className={inputCls} /></div>
        {sel('fatherId', 'বাবা')}
        {sel('motherId', 'মা')}
        {sel('spouseId', 'স্বামী / স্ত্রী')}
        <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">বিবাহের তারিখ</label><input name="marriageDate" type="date" className={inputCls} /></div>
        <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পেশা</label><input name="profession" maxLength={100} className={inputCls} /></div>
        <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">জন্মস্থান / জেলা</label><input name="pob" maxLength={100} className={inputCls} /></div>
      </div>
      <div><label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">সংক্ষিপ্ত পরিচিতি</label><textarea name="bio" rows="2" maxLength={1000} className={inputCls} /></div>
      <button disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs py-3 rounded-xl">{busy ? 'পাঠানো হচ্ছে...' : 'অনুরোধ পাঠান'}</button>
      {msg && <p className="text-xs font-bold break-words">{msg}</p>}
    </form>
  );
}

// ---------- Backup (admin) ----------
const download = (name, text, type) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

export function BackupPanel({ members, pendingMembers, events, gallery, onImport, isSuperAdmin }) {
  const [msg, setMsg] = useState('');
  const stamp = new Date().toISOString().slice(0, 10);
  const exportJson = () => download(`family-backup-${stamp}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), members, pendingMembers, events, gallery }, null, 2), 'application/json');
  const exportCsv = () => {
    const cols = ['name', 'role', 'gender', 'dob', 'marriageDate', 'profession', 'education', 'phone', 'address', 'pob', 'fatherId', 'motherId', 'spouseId'];
    const rows = [cols.join(',')].concat(members.map(m => cols.map(c => csvCell(m[c])).join(',')));
    download(`family-members-${stamp}.csv`, '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.members;
      if (!Array.isArray(list)) throw new Error('ফাইলে সদস্যের তালিকা (members) পাওয়া যায়নি');
      const clean = list.filter(m => m && typeof m === 'object' && m.name).map((m, i) => ({
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
        bio: '', fatherId: '', motherId: '', spouseId: '', role: 'Child', isDeceased: false,
        ...m, id: String(m.id || `m_imp_${Date.now()}_${i}`),
      }));
      if (!clean.length) throw new Error('কোনো বৈধ সদস্য পাওয়া যায়নি');
      if (!window.confirm(`${clean.length} জন সদস্য ইমপোর্ট করবেন? একই আইডির সদস্য থাকলে নতুন তথ্য দিয়ে বদলে যাবে।`)) return;
      const ev = Array.isArray(data.events) ? data.events.filter(x => x && x.id && x.title) : [];
      const gal = Array.isArray(data.gallery) ? data.gallery.filter(x => x && x.id && x.url) : [];
      onImport({ members: clean, events: ev, gallery: gal });
      setMsg(`✅ ${clean.length} জন সদস্য ইমপোর্ট হয়েছে।`);
    } catch (err) {
      setMsg('❌ ' + (err.message || 'ফাইল পড়া যায়নি'));
    }
  };
  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 space-y-3">
        <h3 className="font-bold text-sm">💾 ব্যাকআপ নামান</h3>
        <p className="text-xs text-gray-400">সদস্য, ঘটনা ও গ্যালারির তথ্য ফাইলে সংরক্ষণ করুন। ছবির লিংক থাকবে, ছবির ফাইল নয়।</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportJson} className="bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl">JSON ব্যাকআপ</button>
          <button onClick={exportCsv} className="bg-[#D4AF37] text-black font-bold text-xs px-4 py-2.5 rounded-xl">সদস্য তালিকা (Excel/CSV)</button>
        </div>
      </div>
      {isSuperAdmin && (
        <div className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 space-y-3">
          <h3 className="font-bold text-sm">📥 ইমপোর্ট</h3>
          <p className="text-xs text-gray-400">আগের ব্যাকআপ বা পুরনো সাইটের JSON ফাইল বেছে নিন। ফাইলে সদস্যের তালিকা (members) থাকতে হবে।</p>
          <input type="file" accept="application/json,.json" onChange={onFile} className="text-xs" />
        </div>
      )}
      {msg && <p className="text-xs font-bold break-words">{msg}</p>}
    </div>
  );
}

// ---------- Change the family code (super admin) ----------
export function FamilyCodeForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const code = String(new FormData(form).get('code') || '').trim().toLowerCase();
    if (code.length < 6) { setMsg('❌ কোড কমপক্ষে ৬ অক্ষরের হতে হবে।'); return; }
    if (!window.confirm('নতুন কোড চালু হলে আগের কোডে আর কেউ ঢুকতে পারবে না। এগিয়ে যাবেন?')) return;
    setBusy(true); setMsg('');
    try {
      await rpc('set_family_code', { p_code: code });
      form.reset();
      setMsg('✅ পারিবারিক কোড বদলে গেছে। নতুন কোড সবাইকে জানিয়ে দিন।');
    } catch (err) { setMsg('❌ বদলানো যায়নি: ' + (err.message || 'ত্রুটি')); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 space-y-3">
      <h3 className="font-bold text-sm">🔑 পারিবারিক কোড বদলান</h3>
      <p className="text-xs text-gray-400">কোড বাইরে ছড়িয়ে গেলে নতুন কোড দিন। বড় হাতের অক্ষর ছোট হয়ে যাবে।</p>
      <input name="code" type="text" minLength={6} required placeholder="নতুন কোড (কমপক্ষে ৬ অক্ষর)" className={inputCls} />
      <button disabled={busy} className="bg-red-600 disabled:opacity-60 text-white font-bold text-xs px-4 py-2.5 rounded-xl">{busy ? 'বদলানো হচ্ছে...' : 'কোড বদলান'}</button>
      {msg && <p className="text-xs font-bold break-words">{msg}</p>}
    </form>
  );
}

// ---------- Install-to-home-screen button ----------
export function InstallButton() {
  const [evt, setEvt] = useState(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', () => setDone(true));
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!evt || done) return null;
  return (
    <button type="button" onClick={async () => { evt.prompt(); await evt.userChoice.catch(() => {}); setEvt(null); }} className="text-[11px] font-bold px-3 py-2 rounded-full bg-[#D4AF37] text-black">
      📲 ফোনে অ্যাপের মতো রাখুন
    </button>
  );
}
