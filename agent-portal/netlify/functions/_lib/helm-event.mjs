/* Events added from Helm (the agent calendar). Same shape as the schedule import: the people on the event live in metadata.team, so the event shows in each person's Helm.
   Personal types (meals, rest, personal time) are private to the person who adds them. */
import { zonedToIso } from './schedule-import.mjs';

export const TYPES = {
  connect: { label: 'Meeting or call', event_type: 'meeting', calendar_event_type: 'Meeting', priv: false },
  focus: { label: 'Deep work', event_type: 'other', calendar_event_type: 'Deep work', priv: false },
  move: { label: 'Training', event_type: 'other', calendar_event_type: 'Training', priv: true },
  recharge: { label: 'Meal or rest', event_type: 'personal', calendar_event_type: 'Meal or rest', priv: true },
  travel: { label: 'Travel', event_type: 'other', calendar_event_type: 'Travel', priv: false },
  close: { label: 'Personal', event_type: 'personal', calendar_event_type: 'Personal', priv: true },
};
export const REPEATS = { '': 'Once', w: 'Every week', wd: 'Every weekday', d: 'Every day' };
const clean = (v, n = 300) => String(v == null ? '' : v).trim().slice(0, n);
const people = v => [...new Set(clean(v, 400).split(/[;,]/).map(x => clean(x, 60)).filter(Boolean))];

const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = d => new Date(d + 'T12:00:00Z').getUTCDay(); // 0 Sunday

/* The dates a repeating event falls on (capped, so a series stays small) */
export function occurrences(date, repeat) {
  if (!repeat) return [date];
  const out = [];
  if (repeat === 'w') for (let i = 0; i < 12; i++) out.push(addDays(date, i * 7));
  else if (repeat === 'd') for (let i = 0; i < 28; i++) out.push(addDays(date, i));
  else if (repeat === 'wd') { for (let i = 0; out.length < 20 && i < 40; i++) { const d = addDays(date, i), w = dow(d); if (w >= 1 && w <= 5) out.push(d); } }
  return out;
}

export function normalizeEvent(raw, { defaultHost = '' } = {}) {
  const errors = [], title = clean(raw.title, 200);
  if (!title) errors.push('Add a title');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(clean(raw.date)) ? clean(raw.date) : '';
  if (!date) errors.push('Pick a date');
  const t = x => { const m = clean(x).match(/^(\d{1,2}):(\d{2})$/); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
  const start = t(raw.start), end = t(raw.end);
  if (clean(raw.start) && !start) errors.push('Start time looks wrong');
  if (clean(raw.end) && !end) errors.push('End time looks wrong');
  if (start && end && end <= start) errors.push('The end must be after the start');
  const type = TYPES[raw.type] ? raw.type : 'connect', repeat = REPEATS[raw.repeat || ''] !== undefined ? (raw.repeat || '') : '';
  const host = clean(raw.host, 60) || defaultHost;
  if (!host) errors.push('Choose who this is for');
  return { errors, ev: { title, date, start, end, allDay: !start, type, repeat, where: clean(raw.where), notes: clean(raw.notes, 1000), host, with: people(raw.with) } };
}

export function buildEvents(ev, { hostMember, userId, tz, seriesId }) {
  const spec = TYPES[ev.type], team = [...new Set([ev.host, ...ev.with])];
  return occurrences(ev.date, ev.repeat).map(date => ({
    title: ev.title, event_type: spec.event_type, status: 'scheduled',
    starts_at: ev.allDay ? zonedToIso(date, '00:00', tz) : zonedToIso(date, ev.start, tz),
    ends_at: ev.allDay ? zonedToIso(date, '23:59', tz) : ev.end ? zonedToIso(date, ev.end, tz) : new Date(Date.parse(zonedToIso(date, ev.start, tz)) + 3600000).toISOString(),
    timezone: tz, all_day: ev.allDay, location: ev.where || null, owner_member_id: hostMember?.id || null,
    visibility: spec.priv ? 'private' : 'organization', notes: ev.notes || null, recurrence_rule: null,
    metadata: { calendar_event_type: spec.calendar_event_type, category: 'helm_' + ev.type, team, owner_name: ev.host, created_in: 'helm', series: seriesId || null, repeat: ev.repeat || null, private_to_user_id: spec.priv ? userId : null },
  }));
}
