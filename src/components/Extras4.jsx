import { useEffect, useMemo, useState } from 'react';
import { knownDob } from '@/lib/placeholders';
import { selectRows, upsertRow, deleteRow } from '@/lib/supabase';

const toBn = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const inputCls = 'w-full border rounded-xl p-3 bg-transparent text-xs border-gray-300 dark:border-white/10';

const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const monthKeyOf = (iso) => String(iso || '').slice(0, 7);
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const parts = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };

// Latest 24 months, newest first.
function monthChoices() {
  const [y0, m0] = todayDhaka().split('-').map(Number);
  const out = [];
  for (let i = 0; i < 24; i++) {
    const t = y0 * 12 + (m0 - 1) - i;
    const y = Math.floor(t / 12), m = (t % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

const labelOf = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${toBn(y)}`; };

export function buildIssue(key, { members, events, gallery }) {
  const [y, mm] = key.split('-').map(Number);
  const byId = new Map(members.map(m => [m.id, m]));
  const sameMonth = (iso) => isIso(iso) && parts(iso).m === mm;

  const birthdays = members
    .filter(m => !m.isDeceased && sameMonth(knownDob(m)) && parts(knownDob(m)).y < y)
    .map(m => ({ name: m.name, day: parts(knownDob(m)).d, age: y - parts(knownDob(m)).y }))
    .sort((a, b) => a.day - b.day);

  const seen = new Set();
  const anniversaries = [];
  members.forEach(m => {
    if (m.isDeceased || !sameMonth(m.marriageDate) || parts(m.marriageDate).y >= y) return;
    const sp = byId.get(m.spouseId) || members.find(o => o.spouseId === m.id);
    if (sp && sp.isDeceased) return;
    const pair = [m.id, sp?.id || ''].sort().join('|');
    if (seen.has(pair)) return;
    seen.add(pair);
    anniversaries.push({
      names: sp ? `${m.name} ও ${sp.name}` : m.name,
      day: parts(m.marriageDate).d,
      years: y - parts(m.marriageDate).y,
    });
  });
  anniversaries.sort((a, b) => a.day - b.day);

  const remembrance = members
    .filter(m => m.isDeceased && sameMonth(m.deathDate) && parts(m.deathDate).y <= y)
    .map(m => ({ name: m.name, day: parts(m.deathDate).d, years: y - parts(m.deathDate).y }))
    .sort((a, b) => a.day - b.day);

  const monthEvents = events.filter(e => monthKeyOf(e.date) === key).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const photos = gallery.filter(g => g.type !== 'video' && monthKeyOf(g.date) === key && g.url).slice(0, 6);
  const history = events
    .filter(e => isIso(e.date) && parts(e.date).m === mm && parts(e.date).y < y)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 6);

  return {
    birthdays, anniversaries, remembrance, monthEvents, photos, history,
  };
}

function Section({ icon, title, children }) {
  return (
    <section className="py-3 border-t border-[#D4AF37]/50 break-inside-avoid">
      <h3 className="font-bold text-sm text-[#1E3F20] mb-2">{icon} {title}</h3>
      {children}
    </section>
  );
}

const Line = ({ left, right }) => (
  <li className="flex justify-between gap-3 text-[13px]">
    <span className="break-words min-w-0">{left}</span>
    <span className="text-[#8a6d1d] font-bold whitespace-nowrap">{right}</span>
  </li>
);

export function NewsletterPage({ members, events, gallery, isSuperAdmin, title, familyLabel }) {
  const choices = useMemo(monthChoices, []);
  const [key, setKey] = useState(choices[0]);
  const [notes, setNotes] = useState({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    selectRows('issue_notes', 'select=id,note').then(rows => setNotes(Object.fromEntries(rows.map(r => [r.id, r.note])))).catch(() => {});
  }, []);

  const issue = useMemo(() => buildIssue(key, { members, events, gallery }), [key, members, events, gallery]);
  const note = notes[key] || '';

  const saveNote = async () => {
    try {
      const text = draft.trim();
      if (text) { await upsertRow('issue_notes', { id: key, note: text, updated_at: new Date().toISOString() }); setNotes(p => ({ ...p, [key]: text })); }
      else { await deleteRow('issue_notes', key); setNotes(p => { const n = { ...p }; delete n[key]; return n; }); }
      setEditing(false); setMsg('');
    } catch (e) { setMsg(`সংরক্ষণ হয়নি: ${e.message || e}`); }
  };

  const shareText = () => {
    const bits = [];
    if (issue.birthdays.length) bits.push(`🎂 জন্মদিন ${toBn(issue.birthdays.length)}টি`);
    if (issue.anniversaries.length) bits.push(`💍 বিবাহবার্ষিকী ${toBn(issue.anniversaries.length)}টি`);
    if (issue.remembrance.length) bits.push(`🕯️ স্মরণ ${toBn(issue.remembrance.length)}জন`);
    const url = `${window.location.origin}${window.location.pathname}?tab=newsletter`;
    return `📰 ${title} — ${labelOf(key)} সংখ্যা\n${bits.join(' · ')}\n\nপড়তে সাইটে ঢুকুন:\n${url}`;
  };
  const sendWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, '_blank', 'noopener');

  const empty = !issue.birthdays.length && !issue.anniversaries.length && !issue.remembrance.length
    && !issue.monthEvents.length && !issue.photos.length;

  return (
    <div className="space-y-4">
      <div className="text-center border-b pb-4 print:hidden">
        <h2 className="text-lg font-bold">📰 পারিবারিক পত্রিকা</h2>
        <p className="text-xs text-gray-400 mt-1">প্রতি মাসের সংখ্যা সাইটের তথ্য থেকে নিজে থেকে সাজানো হয়।</p>
      </div>

      <div className="flex gap-2 flex-wrap items-center print:hidden">
        <select value={key} onChange={e => { setKey(e.target.value); setEditing(false); }} className={`${inputCls} flex-1 min-w-[10rem]`}>
          {choices.map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
        </select>
        <button type="button" onClick={sendWhatsApp} className="text-[11px] font-bold px-4 py-3 rounded-xl bg-emerald-600 text-white">💬 হোয়াটসঅ্যাপে পাঠান</button>
        <button type="button" onClick={() => window.print()} className="text-[11px] font-bold px-4 py-3 rounded-xl bg-[#D4AF37] text-black">🖨️ PDF / প্রিন্ট</button>
      </div>

      {isSuperAdmin && !editing && (
        <button type="button" onClick={() => { setDraft(note); setEditing(true); }} className="text-[11px] font-bold px-3 py-2 rounded-full bg-black/10 dark:bg-white/10 print:hidden">
          ✍️ {note ? 'সম্পাদকের কথা বদলান' : 'সম্পাদকের কথা লিখুন'}
        </button>
      )}
      {isSuperAdmin && editing && (
        <div className="space-y-2 print:hidden">
          <textarea rows={4} maxLength={1500} value={draft} onChange={e => setDraft(e.target.value)} className={inputCls} placeholder="এ মাসের জন্য দুই-তিন লাইন বার্তা। খালি রেখে সংরক্ষণ করলে অংশটি মুছে যাবে।" />
          <div className="flex gap-2">
            <button type="button" onClick={saveNote} className="px-4 py-2 rounded-xl bg-[#1E3F20] text-[#D4AF37] text-xs font-bold">সংরক্ষণ</button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl bg-black/10 dark:bg-white/10 text-xs font-bold">বাতিল</button>
          </div>
          {msg && <p className="text-[11px] font-bold text-red-500 break-words">{msg}</p>}
        </div>
      )}

      {/* The paper itself. Only this part is printed. */}
      <article className="print-area bg-[#fffaf0] text-[#1b2a1c] rounded-2xl border-4 border-double border-[#D4AF37] p-5 sm:p-8 shadow-lg">
        <header className="text-center pb-4">
          <p className="text-[10px] tracking-widest text-[#8a6d1d] font-bold">পারিবারিক পত্রিকা</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E3F20] mt-1 break-words">{title}</h1>
          <p className="text-sm font-bold text-[#8a6d1d] mt-1">{labelOf(key)} সংখ্যা</p>
        </header>

        {note && (
          <Section icon="✍️" title="সম্পাদকের কথা">
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{note}</p>
          </Section>
        )}

        {issue.birthdays.length > 0 && (
          <Section icon="🎂" title="এ মাসের জন্মদিন">
            <ul className="space-y-1">{issue.birthdays.map((b, i) => <Line key={i} left={`${b.name} (${toBn(b.age)} বছর)`} right={`${toBn(b.day)} ${MONTHS[Number(key.slice(5)) - 1]}`} />)}</ul>
          </Section>
        )}
        {issue.anniversaries.length > 0 && (
          <Section icon="💍" title="বিবাহবার্ষিকী">
            <ul className="space-y-1">{issue.anniversaries.map((a, i) => <Line key={i} left={`${a.names} (${toBn(a.years)} বছর)`} right={`${toBn(a.day)} ${MONTHS[Number(key.slice(5)) - 1]}`} />)}</ul>
          </Section>
        )}
        {issue.remembrance.length > 0 && (
          <Section icon="🕯️" title="স্মরণ">
            <ul className="space-y-1">{issue.remembrance.map((r, i) => <Line key={i} left={r.name} right={r.years > 0 ? `${toBn(r.years)} বছর হলো` : 'এ মাসে'} />)}</ul>
            <p className="text-[12px] text-[#5b4a1a] mt-2">আল্লাহ তাঁদের জান্নাতবাসী করুন। আমিন।</p>
          </Section>
        )}
        {issue.monthEvents.length > 0 && (
          <Section icon="📌" title="ঘটনা ও ঘোষণা">
            <ul className="space-y-2">
              {issue.monthEvents.map(e => (
                <li key={e.id} className="text-[13px] break-words">
                  <span className="font-bold">{e.icon || '📌'} {e.title}</span>
                  <span className="text-[#8a6d1d]"> · {toBn(parts(e.date).d)} {MONTHS[parts(e.date).m - 1]}</span>
                  {e.description && <span className="block text-[12px] text-[#4a5a4b]">{e.description}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}
        {issue.photos.length > 0 && (
          <Section icon="📸" title="এ মাসের ছবি">
            <div className="grid grid-cols-3 gap-2">
              {issue.photos.map(g => (
                <figure key={g.id}>
                  <img src={g.url} alt={g.title} className="w-full aspect-square object-cover rounded-lg border border-[#D4AF37]/60" />
                  <figcaption className="text-[10px] text-center mt-1 break-words">{g.title}</figcaption>
                </figure>
              ))}
            </div>
          </Section>
        )}
        {issue.history.length > 0 && (
          <Section icon="📜" title={`এই মাসে আমাদের ইতিহাসে`}>
            <ul className="space-y-1">{issue.history.map(e => <Line key={e.id} left={`${e.icon || '📌'} ${e.title}`} right={`${toBn(parts(e.date).y)} সাল`} />)}</ul>
          </Section>
        )}
        {empty && (
          <p className="text-center text-[13px] text-[#5b4a1a] py-6 border-t border-[#D4AF37]/50">
            এই মাসের জন্য দেখানোর মতো কোনো তথ্য নেই। জন্মতারিখ, বিয়ের তারিখ বা ঘটনা যোগ করলে এখানে আসবে।
          </p>
        )}

        <footer className="pt-3 mt-3 border-t border-[#D4AF37]/50 text-center text-[12px] text-[#5b4a1a]">
          {familyLabel}
        </footer>
      </article>
    </div>
  );
}
