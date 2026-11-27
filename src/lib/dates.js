// Upcoming birthdays and marriage anniversaries (month/day based).

const parse = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return { y, m, d };
};

export function nextOccurrence(dateStr, today = new Date()) {
  const p = parse(dateStr);
  if (!p) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(start.getFullYear(), p.m - 1, p.d);
  if (next < start) next = new Date(start.getFullYear() + 1, p.m - 1, p.d);
  const days = Math.round((next - start) / 86400000);
  return { next, days, years: next.getFullYear() - p.y };
}

export function upcomingEvents(members, withinDays = 45, today = new Date()) {
  const out = [];
  const seenCouples = new Set();
  for (const m of members) {
    if (!m.isDeceased) {
      const b = nextOccurrence(m.dob, today);
      // The seed data uses 1995-01-01 as a placeholder date, so ignore that exact value.
      if (b && m.dob !== '1995-01-01' && b.days <= withinDays) out.push({ kind: 'birthday', member: m, ...b });
    }
    if (m.marriageDate && !m.isDeceased) {
      const key = [m.id, m.spouseId].sort().join('|');
      if (m.spouseId && seenCouples.has(key)) continue;
      seenCouples.add(key);
      const a = nextOccurrence(m.marriageDate, today);
      if (a && a.days <= withinDays) {
        const sp = members.find(o => o.id === m.spouseId) || members.find(o => o.spouseId === m.id);
        out.push({ kind: 'anniversary', member: m, spouse: sp || null, ...a });
      }
    }
  }
  return out.sort((x, y) => x.days - y.days);
}

export const bnDate = (d) => d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' });
