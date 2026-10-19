/* Builds netlify/functions/_lib/schedule-wk43-data.mjs from the three planning files:
     node scripts/build-schedule-data.mjs <mdv-models-90day.csv> <Demontez Week 43.html> <MDV Booking Desk Week 43.html>
   Every row becomes one calendar event with the people and models it belongs to, so the importer can put it on the right calendars.
   Rows that appear in more than one file are merged into one event. Review the printed notes before committing the output. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../netlify/functions/_lib/csv.mjs';

const [csvPath, dcPath, deskPath] = process.argv.slice(2);
if (!csvPath || !dcPath || !deskPath) { console.error('Usage: node scripts/build-schedule-data.mjs <csv> <demontez.html> <desk.html>'); process.exit(1); }
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../netlify/functions/_lib/schedule-wk43-data.mjs');
const SET_ID = 'mdv-2026-wk43';
const WEEK = '2026-10-19';

const pad = n => String(n).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const slug = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hm = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const fromMin = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
const names = s => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
const uniq = a => [...new Set(a)];

/* ---- how each kind of row is described on the calendar ---- */
const CSV_TYPES = {
  stay: { event_type: 'housing', label: 'Stay' },
  team: { event_type: 'meeting', label: 'Team meeting' },
  checkin: { event_type: 'meeting', label: 'Check-in' },
  visa: { event_type: 'visa', label: 'Visa' },
  training: { event_type: 'training', label: 'Training' },
  push: { event_type: 'other', label: 'Push' },
  movement: { event_type: 'travel', label: 'Travel' },
  meeting: { event_type: 'meeting', label: 'Meeting' },
  admin: { event_type: 'other', label: 'Admin' },
  deadline: { event_type: 'deadline', label: 'Deadline' },
  digitals: { event_type: 'test', label: 'Digitals' },
  booking: { event_type: 'booking', label: 'Booking' },
  test: { event_type: 'test', label: 'Test shoot' },
  prep: { event_type: 'other', label: 'Prep' },
};
/* What a model sees on their own calendar. Everything else stays on the agency side only. */
const MODEL_SEES = new Set(['checkin', 'training', 'meeting', 'test', 'digitals', 'stay', 'movement']);
const MODEL_SEES_NOTES = new Set(['checkin', 'training', 'digitals']);
const KEEP_FROM_MODEL = /mother agency|push plan|framing|go \/ hold|risk|positioning|decision/i;

const DESK_KINDS = {
  meet: { event_type: 'meeting', label: 'Team meeting' }, book: { event_type: 'other', label: 'Booking desk' },
  scout: { event_type: 'other', label: 'Scouting' }, out: { event_type: 'other', label: 'Outreach' },
  ops: { event_type: 'other', label: 'Operations' }, fixed: { event_type: 'meeting', label: 'On calendar' },
  call: { event_type: 'other', label: 'On call' }, away: { event_type: 'other', label: 'Off MDV desk' },
};
const DC_AREAS = {
  mdv: { event_type: 'other', label: 'MDV', personal: false }, casa: { event_type: 'other', label: 'Casa / VEUX', personal: true },
  cav: { event_type: 'other', label: 'Cavyre', personal: true }, body: { event_type: 'personal', label: 'Body', personal: true },
  pers: { event_type: 'personal', label: 'Personal', personal: true }, rest: { event_type: 'personal', label: 'Recovery', personal: true },
};
const DESK_TEAM = { dc: 'Demontez', bp: 'Branda', eb: 'Emma', ec: 'Erica', tf: 'Troy', sf: 'Sophia', af: 'Amanda', ab: 'Amber', ld: 'Lemair', dy: 'Dalyss' };

const events = [];
const notes = [];

/* ---- 1. the 90-day model schedule ---- */
{
  const { records } = parseCsv(fs.readFileSync(csvPath, 'utf8'), { maxRows: 5000 });
  for (const r of records) {
    const spec = CSV_TYPES[r.type] || { event_type: 'other', label: r.type || 'Event' };
    const models = names(r.models);
    const timed = !!(r.start_et && /^\d{1,2}:\d{2}$/.test(r.start_et));
    const owner = r.owner || (names(r.team)[0] || null);
    const team = uniq([owner, ...names(r.team)].filter(Boolean));
    let visibleToModel = models.length > 0 && MODEL_SEES.has(r.type);
    if (r.type === 'visa') visibleToModel = models.length > 0 && timed;
    if (KEEP_FROM_MODEL.test(r.title)) visibleToModel = false;
    events.push({
      key: `m90:${r.id}`, source: 'models90', date: r.date, end_date: r.end_date || null,
      start: timed ? r.start_et.replace(/^(\d):/, '0$1:') : null, end: timed && r.end_et ? r.end_et.replace(/^(\d):/, '0$1:') : null,
      all_day: !timed, title: r.title, event_type: spec.event_type, label: spec.label, status: 'scheduled',
      location: r.location || null, notes: r.notes || null, models, owner, team,
      model_visible: visibleToModel, notes_hidden_from_model: visibleToModel && !MODEL_SEES_NOTES.has(r.type),
      personal_for: null, area: r.type,
    });
  }
}

/* ---- 2. the booking desk, person by person ---- */
const alias = t => {
  const s = String(t).toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === 'weekly team sync') return 'monday command';
  if (s === 'scouting and outreach') return 'scouting review and outreach';
  if (s === 'scouting review and outreach') return 'scouting review and outreach';
  return s;
};
const dupKey = e => `${e.date}|${e.start || 'all'}|${alias(e.title)}`;
const index = new Map();
for (const e of events) index.set(dupKey(e), e);

function merge(into, add) {
  into.team = uniq([...(into.team || []), ...(add.team || [])]);
  if (!into.notes && add.notes) into.notes = add.notes;
  if (add.status === 'confirmed') { into.status = 'confirmed'; into.on_outlook = true; }
  if (add.conflict) into.conflict = add.conflict;
  into.sources = uniq([...(into.sources || [into.source]), add.source]);
}
function addOrMerge(e) {
  const k = dupKey(e), hit = index.get(k);
  if (hit && !hit.personal_for === !e.personal_for) { merge(hit, e); notes.push(`merged   ${e.source.padEnd(6)} ${k}`); return; }
  index.set(k, e); events.push(e);
}

{
  const sandbox = {};
  const html = fs.readFileSync(deskPath, 'utf8');
  const code = html.slice(html.indexOf('const TEAM={'), html.indexOf('function mins('));
  const { DAYS, I } = vm.runInNewContext(code + ';({DAYS,I})', sandbox);
  const seen = new Map();
  for (const [day, s, e, who, kind, title, note, clash] of I) {
    const spec = DESK_KINDS[kind];
    const allDay = !/^\d{1,2}:\d{2}$/.test(s);
    const team = who.map(id => DESK_TEAM[id]);
    const date = addDays(WEEK, day);
    const fixed = kind === 'fixed';
    const ev = {
      key: '', source: 'desk', date, end_date: null, start: allDay ? null : fromMin(hm(s)), end: !allDay && e ? fromMin(hm(e)) : null,
      all_day: allDay, title, event_type: spec.event_type, label: spec.label, status: fixed ? 'confirmed' : 'scheduled',
      on_outlook: fixed, location: null, notes: note || null, models: [], owner: team.includes('Demontez') && who.length > 1 && kind === 'fixed' ? 'Demontez' : team[0], team,
      model_visible: false, notes_hidden_from_model: false, personal_for: null, area: kind, conflict: clash ? 'Overlaps another meeting at the same time' : null,
    };
    if (title === 'Erika') ev.conflict = 'Overlaps Model Training / New Face (11:00). Suggested: move to 11:30. Not moved.';
    if (title === 'Model Training / New Face' && clash) ev.conflict = 'Overlaps Erika (Zoom) at 11:00. Erika is suggested to move to 11:30. Not moved.';
    if (ev.team.length > 1 && ev.team.includes('Demontez')) ev.owner = 'Demontez';
    if (ev.team.length === 10) ev.owner = 'Demontez';
    const k0 = `desk43:${date}:${ev.start || 'all'}:${slug(title)}:${slug(team.join('-'))}`;
    const n = (seen.get(k0) || 0) + 1; seen.set(k0, n); ev.key = n > 1 ? `${k0}:${n}` : k0;
    addOrMerge(ev);
  }
  void DAYS;
}

/* ---- 3. Demontez's own week ---- */
{
  const html = fs.readFileSync(dcPath, 'utf8');
  const code = html.slice(html.indexOf('const AREAS={'), html.indexOf('const legend='));
  const { DAYS } = vm.runInNewContext(code + ';({DAYS})', {});
  const to24 = (t, atLeast) => {
    const m = String(t).match(/^(\d{1,2}):(\d{2})$/); if (!m) return null;
    const h = Number(m[1]), mm = Number(m[2]);
    const cands = h === 12 ? [12 * 60 + mm] : [h * 60 + mm, (h + 12) * 60 + mm];
    return cands.find(c => c >= atLeast) ?? cands[cands.length - 1];
  };
  DAYS.forEach((d, di) => {
    const date = addDays(WEEK, di); let prev = 0; const seen = new Map();
    for (const [s, e, area, title, note, fixed, clash] of d.b) {
      const spec = DC_AREAS[area];
      let start = null, end = null, allDay = false;
      if (/^\d{1,2}:\d{2}$/.test(s)) { start = to24(s, prev); prev = start; if (e) end = to24(e, start); }
      else if (/^evening$/i.test(s)) { start = 19 * 60; prev = start; } else allDay = true;
      const ev = {
        key: '', source: 'dc', date, end_date: null, start: start == null ? null : fromMin(start), end: end == null ? null : fromMin(end), all_day: allDay,
        title, event_type: fixed ? 'meeting' : spec.event_type, label: fixed ? 'On calendar' : spec.label, status: fixed ? 'confirmed' : 'scheduled', on_outlook: !!fixed,
        location: null, notes: note && note !== 'Zoom' && note !== 'Teams · with Erica' ? note : (note || null), models: [], owner: 'Demontez', team: ['Demontez'],
        model_visible: false, notes_hidden_from_model: false, personal_for: spec.personal ? 'Demontez' : null, area, conflict: clash ? 'Overlaps another meeting at the same time' : null,
      };
      if (title === 'Erika') ev.conflict = 'Overlaps Model Training / New Face (11:00). Suggested: move to 11:30. Not moved.';
      if (title === 'Model Training / New Face' && clash) ev.conflict = 'Overlaps Erika (Zoom) at 11:00. Erika is suggested to move to 11:30. Not moved.';
      if (fixed) ev.personal_for = null;
      const k0 = `dc43:${date}:${ev.start || 'all'}:${slug(title)}`;
      const n = (seen.get(k0) || 0) + 1; seen.set(k0, n); ev.key = n > 1 ? `${k0}:${n}` : k0;
      addOrMerge(ev);
    }
  });
}

/* keys for merged rows stay with the first source; sort for a stable file */
events.sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')) || a.key.localeCompare(b.key));
const keys = new Set(); for (const e of events) { if (keys.has(e.key)) throw new Error('duplicate key ' + e.key); keys.add(e.key); }

/* near-collisions worth a human glance: same day and start, same person, different title */
const near = [];
for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
  const a = events[i], b = events[j];
  if (a.date === b.date && a.start && a.start === b.start && a.source !== b.source && a.team.some(t => b.team.includes(t)) && alias(a.title) !== alias(b.title) && !a.personal_for === !b.personal_for) near.push(`${a.date} ${a.start} [${a.source}] ${a.title}  ~  [${b.source}] ${b.title}`);
}

const body = `/* Generated by scripts/build-schedule-data.mjs — do not edit by hand. */
export const SCHEDULE_SET = ${JSON.stringify({ id: SET_ID, version: 1, timezone: 'America/New_York', weekStart: WEEK, events }, null, 1)};
`;
fs.writeFileSync(OUT, body);

const by = k => events.reduce((m, e) => (m[e[k]] = (m[e[k]] || 0) + 1, m), {});
console.log('events', events.length, 'by source', by('source'));
console.log('with models', events.filter(e => e.models.length).length, '| model-visible', events.filter(e => e.model_visible).length, '| personal-only', events.filter(e => e.personal_for).length, '| on Outlook', events.filter(e => e.on_outlook).length);
console.log('\nmerged duplicates:\n' + notes.join('\n'));
console.log('\nsame start, different title (check these):\n' + (near.join('\n') || '(none)'));
