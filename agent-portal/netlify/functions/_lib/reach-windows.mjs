/* Reach-out windows: the best time to contact someone, from who they are (casting director, photographer, brand…) and where they are.
   Every window is in the PERSON'S local time; bestSlot() turns it into a real moment that also falls inside Demontez's own working hours (ET).
   These are working rules of thumb for fashion, not measured data. Change them here and every lead and planned task follows. */

// role: [label, days (0 Sun to 6 Sat), local windows [start, end] in 24h, why, what to pitch]
export const ROLES = {
  casting:      ['Casting director', [2, 3, 4], [['09:30', '11:00'], ['16:00', '17:30']], 'Before the day\'s castings start, or after they wrap. Avoid Mondays (inbox) and Fridays (holds go out).', 'MDV models: digitals and a package link'],
  photographer: ['Photographer', [2, 3, 4], [['16:00', '18:00'], ['10:30', '12:00']], 'Most shoot mornings and midday; late afternoon is when they read mail.', 'MDV models for tests, and Casa de Veux for creative'],
  brand:        ['Brand / client', [2, 3, 4], [['09:00', '11:00'], ['14:00', '15:30']], 'Early in the working day, midweek, before meetings fill up.', 'MDV models for campaigns, and Casa de Veux for production'],
  designer:     ['Designer / fashion house', [2, 3], [['10:00', '12:00'], ['14:30', '16:00']], 'Midweek mornings. Expect slow replies in the 3 weeks before their own show.', 'MDV models for the show and lookbook'],
  media:        ['Editor / magazine', [1, 2, 3], [['10:00', '12:00'], ['15:00', '17:00']], 'Early in the week, when stories and shoots are being planned.', 'MDV models for editorial, and Casa de Veux stories'],
  stylist:      ['Stylist', [2, 3, 4], [['11:00', '13:00'], ['16:00', '17:30']], 'Late morning before fittings and pulls, or after the day\'s fittings.', 'MDV models for editorial and tests'],
  pr:           ['PR / communications', [2, 3, 4], [['10:00', '12:00'], ['14:00', '16:00']], 'Midweek mornings.', 'Casa de Veux events and MDV talent for activations'],
  production:   ['Production company', [2, 3, 4], [['14:00', '16:00']], 'After the morning call sheets go out.', 'Casa de Veux production, and MDV models for jobs'],
  agency:       ['Agency / mother agency', [1, 2, 3, 4], [['14:00', '16:00']], 'After the morning booking rush, Monday to Thursday.', 'CAVYRE for the agency, and model placements'],
  scout:        ['Scouted model', [1, 2, 3, 4, 6], [['17:00', '19:00'], ['11:00', '13:00']], 'After school or work on weekdays, or late morning Saturday.', 'Signing with Maison de Veux'],
  other:        ['Contact', [2, 3, 4], [['10:00', '12:00']], 'Midweek, mid-morning.', 'Maison de Veux']
};

// How long a company can go quiet before it comes back as a lead, by tier (days).
export const TIER_DAYS = { VIP: 14, A: 21, B: 45, C: 75, '': 45 };
export const tierDays = t => TIER_DAYS[String(t || '').toUpperCase()] ?? TIER_DAYS[''];

export function roleOf({ contactRole = '', companyType = '', kind = '' } = {}) {
  if (kind === 'scouting') return 'scout';
  const r = String(contactRole || '').toLowerCase();
  if (/cast/.test(r)) return 'casting';
  if (/photo/.test(r)) return 'photographer';
  if (/styl/.test(r)) return 'stylist';
  if (/editor|journal|writer|magazine/.test(r)) return 'media';
  if (/\bpr\b|publicist|communications|press/.test(r)) return 'pr';
  if (/producer|production/.test(r)) return 'production';
  if (/booker|agent|agency|scout/.test(r)) return 'agency';
  if (/design|creative director/.test(r)) return 'designer';
  const t = String(companyType || '').toLowerCase();
  if (/casting/.test(t)) return 'casting';
  if (/photo/.test(t)) return 'photographer';
  if (/media|magazine/.test(t)) return 'media';
  if (/\bpr\b|^pr$/.test(t)) return 'pr';
  if (/production/.test(t)) return 'production';
  if (/agency|mother/.test(t)) return 'agency';
  if (/designer|house/.test(t)) return 'designer';
  if (/brand|client/.test(t)) return 'brand';
  return 'other';
}

const CITY_TZ = {
  'paris': 'Europe/Paris', 'london': 'Europe/London', 'milan': 'Europe/Rome', 'milano': 'Europe/Rome', 'rome': 'Europe/Rome',
  'new york': 'America/New_York', 'nyc': 'America/New_York', 'brooklyn': 'America/New_York', 'atlanta': 'America/New_York', 'miami': 'America/New_York',
  'boston': 'America/New_York', 'washington': 'America/New_York', 'philadelphia': 'America/New_York', 'toronto': 'America/Toronto',
  'chicago': 'America/Chicago', 'dallas': 'America/Chicago', 'houston': 'America/Chicago', 'los angeles': 'America/Los_Angeles', 'la': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles', 'seattle': 'America/Los_Angeles', 'mexico city': 'America/Mexico_City', 'sao paulo': 'America/Sao_Paulo', 'são paulo': 'America/Sao_Paulo',
  'lagos': 'Africa/Lagos', 'abuja': 'Africa/Lagos', 'accra': 'Africa/Accra', 'johannesburg': 'Africa/Johannesburg', 'cape town': 'Africa/Johannesburg', 'nairobi': 'Africa/Nairobi',
  'amsterdam': 'Europe/Amsterdam', 'antwerp': 'Europe/Brussels', 'brussels': 'Europe/Brussels', 'copenhagen': 'Europe/Copenhagen', 'stockholm': 'Europe/Stockholm',
  'berlin': 'Europe/Berlin', 'munich': 'Europe/Berlin', 'madrid': 'Europe/Madrid', 'barcelona': 'Europe/Madrid', 'lisbon': 'Europe/Lisbon', 'zurich': 'Europe/Zurich',
  'dubai': 'Asia/Dubai', 'tokyo': 'Asia/Tokyo', 'seoul': 'Asia/Seoul', 'shanghai': 'Asia/Shanghai', 'hong kong': 'Asia/Hong_Kong', 'singapore': 'Asia/Singapore', 'sydney': 'Australia/Sydney'
};
const COUNTRY_TZ = {
  'france': 'Europe/Paris', 'fr': 'Europe/Paris', 'united kingdom': 'Europe/London', 'uk': 'Europe/London', 'gb': 'Europe/London', 'england': 'Europe/London',
  'italy': 'Europe/Rome', 'it': 'Europe/Rome', 'united states': 'America/New_York', 'usa': 'America/New_York', 'us': 'America/New_York', 'canada': 'America/Toronto',
  'nigeria': 'Africa/Lagos', 'ng': 'Africa/Lagos', 'ghana': 'Africa/Accra', 'south africa': 'Africa/Johannesburg', 'kenya': 'Africa/Nairobi',
  'netherlands': 'Europe/Amsterdam', 'belgium': 'Europe/Brussels', 'denmark': 'Europe/Copenhagen', 'sweden': 'Europe/Stockholm', 'germany': 'Europe/Berlin',
  'spain': 'Europe/Madrid', 'portugal': 'Europe/Lisbon', 'switzerland': 'Europe/Zurich', 'brazil': 'America/Sao_Paulo', 'mexico': 'America/Mexico_City',
  'uae': 'Asia/Dubai', 'japan': 'Asia/Tokyo', 'south korea': 'Asia/Seoul', 'korea': 'Asia/Seoul', 'china': 'Asia/Shanghai', 'australia': 'Australia/Sydney'
};
const CITY_OF_TZ = { 'Europe/Paris': 'Paris', 'Europe/London': 'London', 'Europe/Rome': 'Milan', 'America/New_York': 'New York', 'America/Los_Angeles': 'Los Angeles',
  'America/Chicago': 'Chicago', 'Africa/Lagos': 'Lagos', 'Europe/Amsterdam': 'Amsterdam', 'Europe/Berlin': 'Berlin', 'Europe/Madrid': 'Madrid', 'Asia/Tokyo': 'Tokyo' };

export function zoneOf({ city = '', country = '', metadataTz = '' } = {}) {
  if (metadataTz && validTz(metadataTz)) return { tz: metadataTz, city: city || CITY_OF_TZ[metadataTz] || '', known: true };
  const c = String(city || '').toLowerCase().trim(), k = String(country || '').toLowerCase().trim();
  if (CITY_TZ[c]) return { tz: CITY_TZ[c], city: city.trim(), known: true };
  const hit = Object.keys(CITY_TZ).find(n => n.length > 3 && c.includes(n));
  if (hit) return { tz: CITY_TZ[hit], city: city.trim(), known: true };
  if (COUNTRY_TZ[k]) return { tz: COUNTRY_TZ[k], city: city.trim() || CITY_OF_TZ[COUNTRY_TZ[k]] || '', known: true };
  return { tz: OWNER_TZ, city: city.trim(), known: false };
}
function validTz(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (_e) { return false; } }

export const OWNER_TZ = 'America/New_York';
export const OWNER_HOURS = ['09:00', '21:00'];   // Demontez's own outreach hours, ET (his DaySilk workday starts at 9)

// ---- time zone math with Intl only (no libraries in the function bundle)
function parts(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  const o = {}; for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
}
export function zonedToUtc(y, m, d, h, mi, tz) {
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = parts(guess, tz), asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    const diff = Date.UTC(y, m - 1, d, h, mi) - asUtc; if (!diff) break; guess += diff;
  }
  return guess;
}
const hm = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
const label = (ms, tz) => new Date(ms).toLocaleString('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' });

/* The next good moment to reach this person: inside their role's window in their local time AND inside Demontez's hours.
   taken: Set of ms already planned (keeps 25 minutes between tasks). Looks up to 10 days ahead. */
export function bestSlot({ role = 'other', tz = OWNER_TZ, now = Date.now(), taken = new Set(), gapMin = 25 } = {}) {
  const R = ROLES[role] || ROLES.other, [ownA, ownB] = OWNER_HOURS.map(hm), start = now + 15 * 60e3;
  const clash = t => [...taken].some(x => Math.abs(x - t) < gapMin * 60e3);
  for (let pass = 0; pass < 2; pass++) {          // pass 0: the role's windows; pass 1: any weekday 9 to 6 local
    for (let day = 0; day <= 10; day++) {
      const p = parts(start + day * 864e5, tz);
      const wins = pass === 0 ? R[2] : [['09:00', '18:00']];
      if (pass === 0 ? !R[1].includes(p.wd) : (p.wd === 0 || p.wd === 6)) continue;
      for (const [a, b] of wins) {
        for (let t = hm(a); t + 15 <= hm(b); t += 15) {
          const at = zonedToUtc(p.y, p.m, p.d, Math.floor(t / 60), t % 60, tz);
          if (at < start || clash(at)) continue;
          const o = parts(at, OWNER_TZ), om = o.h * 60 + o.mi;
          if (om < ownA || om >= ownB) continue;
          return { at: new Date(at).toISOString(), ms: at, local: label(at, tz), mine: label(at, OWNER_TZ), fallback: pass === 1 };
        }
      }
    }
  }
  return null;
}

export function timing({ role, tz, city, known, now, taken }) {
  const R = ROLES[role] || ROLES.other, s = bestSlot({ role, tz, now, taken });
  if (s) taken.add(s.ms);
  const same = tz === OWNER_TZ;
  return {
    role, role_label: R[0], pitch: R[4], tz, city: city || '', tz_known: !!known,
    best_at: s ? s.at : null,
    best_label: s ? (same ? s.mine + ' ET' : `${s.mine} ET (${s.local} ${city || tz.split('/').pop().replace(/_/g, ' ')})`) : '',
    best_why: s ? (s.fallback ? 'No overlap with the usual window inside your hours, so this is their working day. ' : '') + R[3] : R[3]
  };
}
