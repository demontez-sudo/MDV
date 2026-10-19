/* Interest call schedules: the one format used by the form and by the pasted list.
   Each call becomes (1) an event on the agent calendar, shown in Helm as an Interest call, and (2) two tasks for the host:
   prepare before the call, and decide (sign, develop or pass) after it. The candidate is not a model yet, so the event is not linked to a model calendar. */
import { parseCsv } from './csv.mjs';
import { zonedToIso } from './schedule-import.mjs';

export const CHANNELS = ['Zoom', 'Phone', 'In person', 'Teams', 'WhatsApp', 'FaceTime', 'Other'];
export const MARKETS = ['New York', 'Paris', 'Other'];
export const OUTCOMES = { sign: 'Sign', develop: 'Develop', pass: 'Pass', no_show: 'No show', reschedule: 'Reschedule' };
export const COLUMNS = [
  ['candidate', 'Candidate name', 'Required. Who the call is with.'],
  ['instagram', 'Instagram or contact', 'Handle, email or phone. Optional.'],
  ['market', 'Market', 'New York, Paris or Other.'],
  ['date', 'Date', 'YYYY-MM-DD or M/D/YYYY. Required.'],
  ['time', 'Start time', 'Eastern Time. 24-hour (14:30) or 2:30pm. Required.'],
  ['minutes', 'Length in minutes', 'Default 30.'],
  ['channel', 'How', 'Zoom, Phone, In person, Teams, WhatsApp, FaceTime or Other. Default Zoom.'],
  ['link', 'Link or place', 'Meeting link, phone number or address. Optional.'],
  ['host', 'Host', 'Team member who takes the call. Default: you.'],
  ['with', 'Also on the call', 'Other team members, separated by ; Optional.'],
  ['source', 'Where we found them', 'Instagram, TikTok, scout name, referral, open call. Optional.'],
  ['notes', 'Notes', 'Anything to know before the call. Optional.'],
];
export const CSV_TEMPLATE = COLUMNS.map(c => c[0]).join(',') + '\n'
  + 'Thanh Tran,@thanh.tran,New York,2026-10-20,08:00,30,Zoom,https://zoom.us/j/0000000000,Demontez,,Instagram,Tall and Paris-facing\n'
  + 'Roberta Silva,roberta@example.com,Paris,2026-10-20,09:30,30,Zoom,,Demontez,Erica,Scout referral,Mother agency in Milan\n';

const clean = (v, n = 300) => String(v == null ? '' : v).trim().slice(0, n);
const norm = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => norm(s).replace(/ /g, '-');

export function parseCallsCsv(text) {
  const { records } = parseCsv(String(text || ''), { maxRows: 200 });
  const map = { name: 'candidate', candidate_name: 'candidate', contact: 'instagram', handle: 'instagram', city: 'market', start: 'time', start_time: 'time', length: 'minutes', duration: 'minutes', how: 'channel', platform: 'channel', place: 'link', location: 'link', also_on_the_call: 'with', attendees: 'with', found: 'source', where_we_found_them: 'source' };
  return records.map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r)) { const key = norm(k).replace(/ /g, '_'); o[map[key] || key] = v; }
    return o;
  });
}

function pickDate(v) {
  const s = clean(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return '';
}
function pickTime(v) {
  const s = clean(v).toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return '';
  let h = Number(m[1]); const mi = Number(m[2] || 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}
const pickMarket = v => { const n = norm(v); return /^(ny|nyc|new york|newyork)$/.test(n) ? 'New York' : /^(paris|pa|fr)$/.test(n) ? 'Paris' : n ? 'Other' : 'New York'; };
const pickChannel = v => { const n = norm(v); return CHANNELS.find(c => norm(c) === n) || (n ? 'Other' : 'Zoom'); };
const people = v => [...new Set(clean(v, 400).split(/[;,]/).map(x => clean(x, 60)).filter(Boolean))];

/* One raw row (from the form or the list) -> a clean call, or the reasons it cannot be scheduled. */
export function normalizeCall(raw, { defaultHost = '' } = {}) {
  const errors = [], candidate = clean(raw.candidate, 120);
  if (!candidate) errors.push('Candidate name is required');
  const date = pickDate(raw.date), time = pickTime(raw.time);
  if (!date) errors.push('Date must look like 2026-10-20 or 10/20/2026');
  if (!time) errors.push('Start time must look like 14:30 or 2:30pm');
  const minutes = Math.min(240, Math.max(10, Math.round(Number(raw.minutes) || 30)));
  const call = {
    candidate, instagram: clean(raw.instagram, 120), market: pickMarket(raw.market), date, time, minutes,
    channel: pickChannel(raw.channel), link: clean(raw.link, 300), host: clean(raw.host, 60) || defaultHost, with: people(raw.with),
    source: clean(raw.source, 120), notes: clean(raw.notes, 1000),
    prep_task: raw.prep_task !== false && raw.prep_task !== 'false', decide_task: raw.decide_task !== false && raw.decide_task !== 'false',
  };
  if (!call.host) errors.push('Host is required');
  call.key = `ic:${slug(candidate)}:${date}:${time}`;
  return { call, errors };
}

export function buildEvent(call, { hostMember, tz }) {
  const starts = zonedToIso(call.date, call.time, tz);
  const ends = new Date(Date.parse(starts) + call.minutes * 60000).toISOString();
  const team = [...new Set([call.host, ...call.with])];
  const lines = [`Interest call with ${call.candidate}${call.instagram ? ` (${call.instagram})` : ''}`, `${call.channel}${call.link ? ' · ' + call.link : ''} · ${call.minutes} min · ${call.market}`, call.source ? `Found via: ${call.source}` : '', call.notes].filter(Boolean);
  return {
    title: `${call.candidate} x MDV`, event_type: 'meeting', status: 'scheduled', starts_at: starts, ends_at: ends, timezone: tz, all_day: false,
    location: call.link || call.channel, owner_member_id: hostMember?.id || null, visibility: 'organization', notes: lines.join('\n'), recurrence_rule: null,
    metadata: {
      calendar_event_type: 'Interest call', category: 'interest_call', team, owner_name: call.host, interest_key: call.key,
      interest_call: { candidate: call.candidate, instagram: call.instagram, market: call.market, channel: call.channel, link: call.link, source: call.source, minutes: call.minutes, outcome: null },
    },
  };
}

export function buildTasks(call, { tz }) {
  const starts = Date.parse(zonedToIso(call.date, call.time, tz)), ends = starts + call.minutes * 60000;
  const evening = Date.parse(zonedToIso(call.date, '17:00', tz));
  const out = [];
  const info = [call.instagram, call.link, call.source && `Found via ${call.source}`, call.notes].filter(Boolean).join(' · ');
  if (call.prep_task) out.push({ title: `Prep: review ${call.candidate}`, description: info || null, priority: 'normal', due_at: new Date(starts - 60 * 60000).toISOString(), category: 'Interest call' });
  if (call.decide_task) out.push({ title: `Decide on ${call.candidate}: sign, develop or pass`, description: 'Log the outcome on the call in Helm.', priority: 'high', due_at: new Date(Math.max(evening, ends + 30 * 60000)).toISOString(), category: 'Interest call' });
  return out;
}
