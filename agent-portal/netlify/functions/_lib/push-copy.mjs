/* Alert wording. Short, warm and specific: what it is, when it lands, what to do about it.
   Every builder returns { title, body, level, icon }.
   level: 'info' (a heads-up), 'soon' (needs you today), 'urgent' (hard stop, cannot slide), 'win' (good news).
   The device decides how loud to be from the level: urgent stays on screen and buzzes, info is quiet. */

const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const hoursWord = h => h < 1 ? 'under an hour' : h < 2 ? 'about an hour' : h < 24 ? `about ${Math.round(h)} hours` : 'tomorrow';
const minsWord = m => m < 60 ? `${Math.max(1, Math.round(m))} minutes` : m < 120 ? 'an hour' : `${Math.round(m / 60)} hours`;

/* task: { title, label (e.g. "Fri Nov 13, 5:00 PM ET"), hard, audience: 'staff'|'model'|'partner', owner } */
export function dueSoon(t, hours) {
  const name = clip(t.title, 70), when = t.label || 'soon';
  if (t.audience === 'model') return { icon: 'clock', level: t.hard ? 'soon' : 'info', title: `⏳ Coming up: ${name}`, body: `Due ${when}. ${t.hard ? 'This one has a firm deadline, so do it first today.' : 'A little time today now saves a rush later.'}` };
  if (t.hard) return { icon: 'flag', level: 'soon', title: `🎯 Hard stop ${hours <= 24 ? 'tomorrow' : 'ahead'}: ${name}`, body: `Locks ${when}. It cannot slide, so put it in your day now.` };
  return { icon: 'clock', level: 'info', title: `⏳ Due ${hoursWord(hours)}: ${name}`, body: `Due ${when}.${t.owner ? ` Owner: ${t.owner}.` : ''}` };
}
export function hardStop(t, minutes) {
  const name = clip(t.title, 70);
  if (t.audience === 'model') return { icon: 'flag', level: 'urgent', title: `🚨 ${minsWord(minutes)} left: ${name}`, body: `This deadline is firm. It closes at ${t.label || 'the deadline'}.` };
  return { icon: 'flag', level: 'urgent', title: `🚨 Hard stop in ${minsWord(minutes)}`, body: `${name} locks at ${t.label || 'the deadline'}. Nothing after it can slide.` };
}
export function overdue(t) {
  const name = clip(t.title, 70);
  if (t.audience === 'model') return { icon: 'alert', level: 'soon', title: `⚠️ Missed: ${name}`, body: `This was due ${t.label || 'earlier'}. Send it now, or message your agent if you need more time.` };
  return { icon: 'alert', level: 'soon', title: `⚠️ Slipped: ${name}`, body: `Was due ${t.label || 'earlier'}. Finish it, or ask for a new date so nobody is blocked.` };
}
export function missedForBoss(t) {
  return { icon: 'compass', level: 'urgent', title: `🧭 ${t.owner || 'Someone'} missed a hard stop`, body: `${clip(t.title, 80)} was due ${t.label || 'earlier'}. It may need a nudge or a new plan.` };
}
export function weekAhead({ count, hard, first }) {
  const lead = first ? ` First up: ${clip(first.title, 60)}${first.label ? ' (' + first.label + ')' : ''}.` : '';
  return { icon: 'calendar', level: 'info', title: '🗓️ Your week ahead', body: `${count} deadline${count === 1 ? '' : 's'} this week${hard ? `, ${hard} of them hard stops` : ''}.${lead}` };
}
export function newTask({ title, due }) {
  return { icon: 'pin', level: 'info', title: '📌 New on your plate', body: `${clip(title, 120)}${due ? ` · due ${due}` : ''}` };
}
export function meeting({ title, when, provider }) {
  const via = provider ? ` on ${provider}` : '';
  return { icon: 'video', level: 'info', title: `📹 Meeting${via}: ${clip(title, 70)}`, body: `${when || 'Time set in your calendar'}. The join link is in the event and in your task.` };
}
export function gameplanLive({ audience, count, first }) {
  if (audience === 'model') return { icon: 'sparkle', level: 'win', title: '✨ Your season plan is live', body: 'Open Gameplan to see every step with its date and time: skin, walk, health, test shoots and travel.' };
  return { icon: 'sparkle', level: 'win', title: '🎉 The 90-day gameplan is live', body: `You own ${count} deadline${count === 1 ? '' : 's'}.${first ? ` The first is ${first}.` : ''} Open Tasks to see each date and time.` };
}
/* a showcase for the Alerts page: one of each level */
export function sample(level) {
  if (level === 'urgent') return { icon: 'flag', level: 'urgent', title: '🚨 Hard stop in 2 hours', body: 'Example: Lock Lagos flights. This is how an urgent alert looks and sounds on this device. It stays on screen until you dismiss it.' };
  if (level === 'soon') return { icon: 'alert', level: 'soon', title: '⚠️ Slipped: Send visa letters', body: 'Example: was due this morning. This is how a needs-you-today alert looks.' };
  if (level === 'win') return { icon: 'sparkle', level: 'win', title: '🎉 The 90-day gameplan is live', body: 'Example of good news. Quiet buzz, no fuss.' };
  return { icon: 'clock', level: 'info', title: '⏳ Due tomorrow: Paris booker shortlist', body: 'Example heads-up. Quiet, and it waits for you.' };
}
