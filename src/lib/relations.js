// Works out how two family members are related, in Bengali, from the father/mother/spouse links.

const MALE_ROLES = new Set(['Dada', 'Father']);
const FEMALE_ROLES = new Set(['Dadi', 'Mother']);

export function makeGender(members) {
  const byId = new Map(members.map(m => [m.id, m]));
  const fathers = new Set(members.map(m => m.fatherId).filter(Boolean));
  const mothers = new Set(members.map(m => m.motherId).filter(Boolean));
  const cache = new Map();
  const guess = (m, depth = 0) => {
    if (m.gender === 'male' || m.gender === 'female') return m.gender;
    if (MALE_ROLES.has(m.role) || fathers.has(m.id)) return 'male';
    if (FEMALE_ROLES.has(m.role) || mothers.has(m.id)) return 'female';
    const sp = byId.get(m.spouseId) || members.find(o => o.spouseId === m.id);
    if (sp && depth === 0) {
      const g = guess(sp, 1);
      if (g) return g === 'male' ? 'female' : 'male';
    }
    return null;
  };
  return (m) => {
    if (!cache.has(m.id)) cache.set(m.id, guess(m));
    return cache.get(m.id);
  };
}

// Every ancestor with its distance and the first step taken (father or mother side).
function ancestors(m, byId) {
  const out = new Map([[m.id, { d: 0, side: null, via: null }]]);
  let layer = [{ p: m, side: null, via: null }];
  for (let d = 1; d <= 8 && layer.length; d++) {
    const next = [];
    for (const { p, side, via } of layer) {
      for (const [key, pid] of [['father', p.fatherId], ['mother', p.motherId]]) {
        const parent = byId.get(pid);
        if (!parent || out.has(parent.id)) continue;
        const s = side || key;
        const v = d === 1 ? p.id : via; // child of the ancestor on this line
        out.set(parent.id, { d, side: s, via: d === 1 ? m.id : via, childOnLine: p.id });
        next.push({ p: parent, side: s, via: v });
      }
    }
    layer = next;
  }
  return out;
}

const pick = (g, male, female, both) => (g === 'male' ? male : g === 'female' ? female : both);

function blood(a, b, byId, gender) {
  if (a.id === b.id) return 'নিজে';
  const aa = ancestors(a, byId);
  const bb = ancestors(b, byId);
  let best = null;
  for (const [id, infoA] of aa) {
    const infoB = bb.get(id);
    if (!infoB) continue;
    const total = infoA.d + infoB.d;
    if (!best || total < best.total) best = { id, dA: infoA.d, dB: infoB.d, total, infoA, infoB };
  }
  if (!best) return null;
  const { dA, dB, infoA, infoB } = best;
  const gb = gender(b);
  const ga = gender(a);

  if (dA === 0) { // b descends from a
    if (dB === 1) return pick(gb, 'ছেলে', 'মেয়ে', 'সন্তান');
    if (dB === 2) return pick(gb, 'নাতি', 'নাতনি', 'নাতি/নাতনি');
    if (dB === 3) return pick(gb, 'প্রপৌত্র', 'প্রপৌত্রী', 'প্রপৌত্র/প্রপৌত্রী');
    return 'বংশধর';
  }
  if (dB === 0) { // b is an ancestor of a
    const paternal = infoA.side === 'father';
    if (dA === 1) return pick(gb, 'বাবা', 'মা', 'বাবা/মা');
    if (dA === 2) return paternal ? pick(gb, 'দাদা', 'দাদি', 'দাদা/দাদি') : pick(gb, 'নানা', 'নানি', 'নানা/নানি');
    if (dA === 3) return paternal ? pick(gb, 'পরদাদা', 'পরদাদি', 'পরদাদা/পরদাদি') : pick(gb, 'পরনানা', 'পরনানি', 'পরনানা/পরনানি');
    return 'পূর্বপুরুষ';
  }
  if (dA === 1 && dB === 1) return pick(gb, 'ভাই', 'বোন', 'ভাই/বোন');
  if (dA === 1 && dB === 2) { // nephew or niece
    const sibling = byId.get(infoB.childOnLine);
    const sg = sibling ? gender(sibling) : null;
    if (sg === 'male') return pick(gb, 'ভাতিজা', 'ভাতিজি', 'ভাতিজা/ভাতিজি');
    if (sg === 'female') return pick(gb, 'ভাগ্নে', 'ভাগ্নি', 'ভাগ্নে/ভাগ্নি');
    return pick(gb, 'ভাতিজা/ভাগ্নে', 'ভাতিজি/ভাগ্নি', 'ভাতিজা-ভাতিজি/ভাগ্নে-ভাগ্নি');
  }
  if (dA === 2 && dB === 1) { // uncle or aunt
    return infoA.side === 'father'
      ? pick(gb, 'চাচা', 'ফুফু', 'চাচা/ফুফু')
      : pick(gb, 'মামা', 'খালা', 'মামা/খালা');
  }
  if (dA === 2 && dB === 2) { // cousin
    const q = byId.get(infoB.childOnLine);
    const qg = q ? gender(q) : null;
    const word = pick(gb, 'ভাই', 'বোন', 'ভাই/বোন');
    if (infoA.side === 'father') return (qg === 'female' ? 'ফুফাতো ' : qg === 'male' ? 'চাচাতো ' : 'চাচাতো/ফুফাতো ') + word;
    return (qg === 'female' ? 'খালাতো ' : qg === 'male' ? 'মামাতো ' : 'মামাতো/খালাতো ') + word;
  }
  void ga;
  return 'দূরের আত্মীয় (একই বংশ)';
}

// Returns a sentence-ready term: what b is to a.
export function relationTerm(a, b, members) {
  if (!a || !b) return '';
  const byId = new Map(members.map(m => [m.id, m]));
  const gender = makeGender(members);
  const spouseOf = (m) => byId.get(m.spouseId) || members.find(o => o.spouseId === m.id) || null;

  const direct = blood(a, b, byId, gender);
  if (direct) return direct;

  const spA = spouseOf(a);
  const spB = spouseOf(b);
  if (spA && spA.id === b.id) return pick(gender(b), 'স্বামী', 'স্ত্রী', 'স্বামী/স্ত্রী');
  if (spA) {
    const t = blood(spA, b, byId, gender);
    if (t) {
      const own = gender(a) === 'male' ? 'স্ত্রীর' : gender(a) === 'female' ? 'স্বামীর' : 'সঙ্গীর';
      const special = {
        'বাবা': 'শ্বশুর', 'মা': 'শাশুড়ি', 'ছেলে': 'ছেলে (সৎ)', 'মেয়ে': 'মেয়ে (সৎ)',
      };
      if (t === 'বাবা' || t === 'মা') return special[t];
      return `${own} ${t}`;
    }
  }
  if (spB) {
    const t = blood(a, spB, byId, gender);
    if (t) {
      if (t === 'ছেলে') return 'পুত্রবধূ';
      if (t === 'মেয়ে') return 'জামাই';
      return `${t}র ${pick(gender(b), 'স্বামী', 'স্ত্রী', 'স্বামী/স্ত্রী')}`;
    }
  }
  return 'সম্পর্ক নির্ণয় করা যায়নি (বাবা-মা বা সঙ্গীর তথ্য যোগ করুন)';
}
