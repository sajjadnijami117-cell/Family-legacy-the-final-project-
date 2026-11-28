// The add-member form used to fill blank fields with made-up values (a birth date of 1 January 1995, the place
// "চট্টগ্রাম" and a stock biography). Those are not facts, so everything that prints a person's details
// reads them through these helpers and treats the stock values as "unknown".
export const PLACEHOLDER_DOB = '1995-01-01';
export const DEFAULT_BIO = 'পরিবারের এক আদরের সদস্য।';
export const DEFAULT_PLACE = 'চট্টগ্রাম';

export const knownDob = (m) => (m && /^\d{4}-\d{2}-\d{2}$/.test(m.dob || '') && m.dob !== PLACEHOLDER_DOB ? m.dob : '');
export const knownBio = (m) => (m && m.bio && m.bio.trim() && m.bio.trim() !== DEFAULT_BIO ? m.bio.trim() : '');

// A profile nobody ever edited still carries all the stock values.
const untouched = (m) => m.dob === PLACEHOLDER_DOB && (m.bio || '').trim() === DEFAULT_BIO;
export const knownPob = (m) => {
  const p = String((m && m.pob) || '').trim();
  if (!p) return '';
  return p === DEFAULT_PLACE && untouched(m) ? '' : p;
};
