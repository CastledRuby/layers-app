// A one-page summary of someone (docs/roadmap.md, "The plan from here", step
// 5): Export summary on their profile. This makes the page as a small,
// self-contained HTML document (light colours, A4, no scripts); the main
// process turns it into a PDF on this computer (electron/main.cjs,
// export-summary). Nothing leaves the computer unless you send the file.

import { CATEGORIES, DIM_LABELS, DIM_ORDER, TYPE_META } from '../data/constants.js';
import { INITIAL_COLORS, initialsOf, isInitials, isPhoto } from '../data/avatars.js';
import { activityGrid } from './activity.js';
import { dateKind, keyDateLabel } from './calendar.js';
import { MONTH_NAMES, parseISODay, sortByDay } from './dates.js';
import { summaryFor } from './text.js';
import { THEME_LIGHT as T } from '../theme.js';

const LAYER_NAMES = { 1: 'Orientation', 2: 'Exploratory', 3: 'Affective / Personal', 4: 'Stable / Close' };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const longDay = (iso) => { const d = parseISODay(iso); return d ? `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` : ''; };
const layerColor = (n) => T[`layer${n}`];
const layerDeep = (n) => T[`layer${n}Deep`];
const layerTint = (n) => T[`layer${n}Tint`];

function avatar(person) {
  const box = 'width:64px;height:64px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden';
  if (isPhoto(person.avatar)) return `<div style="${box};border:2px solid ${layerColor(person.layer)}"><img src="${esc(person.avatar.src)}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`;
  if (isInitials(person.avatar)) {
    const c = INITIAL_COLORS.find(x => x.key === person.avatar.color);
    const bg = c && c.bg ? c.bg : layerTint(person.layer);
    const ink = c && c.bg ? '#FFFFFF' : layerDeep(person.layer);
    return `<div style="${box};background:${bg};color:${ink};font-family:Georgia,serif;font-size:24px;font-weight:600">${esc(initialsOf(person.name))}</div>`;
  }
  return `<div style="${box};background:${T.paperRaised};border:2px solid ${layerColor(person.layer)};font-size:32px">${esc(person.emoji || '🧑')}</div>`;
}

function section(title, body) {
  return body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
}

// The page for `person`, with their logs from `journal`, as of `today`.
export function summaryHtml(person, { journal = [], today }) {
  const logs = journal.filter(j => j.personId === person.id);
  const recent = [...logs].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 8);
  const dims = DIM_ORDER.map(k => `<div class="bar"><span>${esc(DIM_LABELS[k])}</span><i><b style="width:${Math.max(0, Math.min(100, (person.dims || {})[k] || 0))}%;background:${layerColor(person.layer)}"></b></i><em>${Math.round((person.dims || {})[k] || 0)}</em></div>`).join('');
  const known = CATEGORIES.map(cat => {
    const items = (person[cat.key] || []).filter(it => !it.archived).slice(0, 6);
    return items.length ? `<div class="known"><h3>${esc(cat.label)}</h3><ul>${items.map(it => `<li>${esc(it.emoji || '')} ${esc(it.text)}</li>`).join('')}</ul></div>` : '';
  }).join('');
  const dates = (person.dates || []).map(kd => `<li>${esc(dateKind(kd.kind).emoji)} ${esc(keyDateLabel(person, kd))}: ${esc(kd.yearly ? longDay(kd.date).replace(/ \d{4}$/, '') : longDay(kd.date))}</li>`).join('');
  const goals = (person.goals || []).map(g => `<div class="bar"><span>${esc(g.title)}</span><i><b style="width:${Math.max(0, Math.min(100, g.progress || 0))}%;background:${T.accent}"></b></i><em>${Math.round(g.progress || 0)}%</em></div>`).join('');
  const timeline = sortByDay(person.timeline || []).slice(-8).map(t => `<li><span>${esc(t.at ? longDay(t.at) : t.date || '')}</span> ${esc(t.label)}</li>`).join('');
  const recentList = recent.map(j => `<li><span>${esc(longDay(j.at))}</span> ${esc((TYPE_META[j.type] || TYPE_META.other).emoji)} ${esc(summaryFor(j))}${j.reflection ? ` <q>${esc(j.reflection)}</q>` : ''}</li>`).join('');
  const grid = activityGrid(logs, today);
  const shades = [T.line, ...[30, 55, 78, 100].map(pct => `color-mix(in srgb, ${layerColor(person.layer)} ${pct}%, #FFFFFF)`)];
  const heat = `<div class="heat">${grid.weeks.map(week => `<div>${week.map(c => `<i style="background:${c.future ? 'transparent' : shades[c.level]}"></i>`).join('')}</div>`).join('')}</div><p class="small">${grid.total} ${grid.total === 1 ? 'log' : 'logs'} in the last six months</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(person.name)}</title><style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: ${T.ink}; background: #FFFFFF; }
header { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; border-bottom: 2px solid ${layerColor(person.layer)}; }
h1 { font-family: Georgia, serif; font-size: 24px; margin: 0; }
h2 { font-family: Georgia, serif; font-size: 13px; margin: 0 0 6px; }
h3 { font-size: 10.5px; margin: 0 0 3px; color: ${T.inkSoft}; }
.layer { display: inline-block; margin-top: 4px; padding: 2px 9px; border-radius: 99px; background: ${layerTint(person.layer)}; color: ${layerDeep(person.layer)}; font-weight: 600; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 22px; margin-top: 12px; }
section { break-inside: avoid; }
.bar { display: grid; grid-template-columns: 38% 1fr 30px; align-items: center; gap: 6px; margin: 3px 0; }
.bar i { height: 6px; border-radius: 3px; background: ${T.line}; overflow: hidden; display: block; }
.bar b { display: block; height: 100%; border-radius: 3px; }
.bar em { font-style: normal; text-align: right; color: ${T.inkSoft}; }
ul { margin: 0; padding-left: 14px; } li { margin: 2px 0; }
li span { color: ${T.inkSoft}; }
q { color: ${T.inkSoft}; font-style: italic; }
.known { margin-bottom: 6px; }
.heat { display: flex; gap: 2px; } .heat div { display: flex; flex-direction: column; gap: 2px; } .heat i { width: 7px; height: 7px; border-radius: 1.5px; display: block; }
.small, footer { color: ${T.inkSoft}; font-size: 9px; }
footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid ${T.line}; }
</style></head><body>
<header>${avatar(person)}<div><h1>${esc(person.name)}</h1><div class="layer">Layer ${person.layer}: ${esc(LAYER_NAMES[person.layer] || '')}, ${Math.round(person.overall || 0)}% in</div></div></header>
<div class="cols">
${section('How you are with each other', dims)}
${section('Activity', heat)}
${section(`What you know about ${person.name}`, known)}
${section('Key dates', dates ? `<ul>${dates}</ul>` : '')}
${section('Goals', goals)}
${section('Timeline', timeline ? `<ul>${timeline}</ul>` : '')}
${section('Recently', recentList ? `<ul>${recentList}</ul>` : '')}
</div>
<footer>Made with Layers on ${esc(longDay(today))}. Private: a reflection of your own notes, not a measurement of anyone.</footer>
</body></html>`;
}

// "Priya summary 7 Oct 2026.pdf", without characters Windows refuses in names.
export function summaryFileName(person, today) {
  return `${String(person.name).replace(/[\\/:*?"<>|]/g, '').trim() || 'Someone'} summary ${longDay(today)}.pdf`;
}
