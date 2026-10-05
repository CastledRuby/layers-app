// The quick-add box: Ctrl+Shift+L from anywhere in Windows opens this small
// window over whatever you're doing (electron/main.cjs, "Quick add"; the
// page's #quick). Type a plan or a log as a sentence (lib/sentence.js) and
// the preview shows exactly what will be saved:
//   Enter       hands it to the main window, which saves it as Ctrl+K would
//               (with Undo there), then the box closes
//   Ctrl+Enter  opens it in Layers instead, in its full sheet
//   Ctrl+Z      undoes what was just saved, while the box still shows it or
//               in the empty box opened again soon after; Ctrl+Y redoes it
//   Esc         closes the box, as does clicking somewhere else
// The box only reads your people from what Layers last saved; the main window
// does all the saving (window.layersQuick, preload.cjs).

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, Check, PenLine, Sparkles } from 'lucide-react';
import { Kbd } from './components/atoms.jsx';
import { formatCalendarDate, formatTime12, formatWeekdays, parseISODay, toISODate } from './lib/dates.js';
import { useSystemDark } from './lib/hooks.js';
import { readSentence } from './lib/sentence.js';
import { STORAGE_KEY } from './lib/storage.js';
import { COLORS, CSS } from './theme.js';

const RATING_LABELS = ['Very brief', 'Casual', 'Good', 'Personal', 'Deep'];
const SAVED_MS = 960; // how long "Saved" shows before the box closes
const UNDO_MS = 6500; // Layers' own Undo lasts 7 s

function readSaved() {
  try {
    const s = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return s && typeof s === 'object' ? s : {};
  } catch { return {}; }
}
const listNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// "Fri 9 October, 10:00 AM to 11:00 AM", or how it repeats.
function whenText(r) {
  const from = formatCalendarDate(parseISODay(r.day));
  const day = r.repeat === 'daily' ? `Every day, from ${from}` : r.repeat === 'weekly' ? `${formatWeekdays(r.weekdays)}, from ${from}` : from;
  return `${day}, ${r.allDay ? 'all day' : `${formatTime12(r.time)} to ${formatTime12(r.time + r.duration)}`}`;
}
const MISSING_TEXT = {
  when: 'When? Add a day or a time, like "fri 10am".',
  who: 'Who was it with? Add a name.',
  rating: 'How was it? Add brief, casual, good, personal or deep (or 1 to 5).',
};

export function QuickAdd() {
  const bridge = typeof window !== 'undefined' ? window.layersQuick : null;
  const [saved, setSaved] = useState(readSaved);
  const [text, setText] = useState('');
  const [done, setDone] = useState(null); // { line, undone } once saved
  const lastSave = useRef(null); // { line, at }: what the box saved last
  const [recent, setRecent] = useState(null); // that, if it can still be undone
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const timer = useRef(null);
  const systemDark = useSystemDark();
  const mode = saved.themeMode || 'system';
  const dark = mode === 'system' ? systemDark : mode === 'dark';
  const people = useMemo(() => (Array.isArray(saved.people) ? saved.people.filter(p => p && p.id && typeof p.name === 'string') : []), [saved]);
  const today = toISODate(new Date());
  const r = useMemo(() => readSentence(text, { people, today }), [text, people, today]);
  const who = r ? r.personIds.map(id => people.find(p => p.id === id).name) : [];
  const ready = !!r && r.missing.length === 0;

  function reset() {
    clearTimeout(timer.current);
    setSaved(readSaved());
    setText('');
    setDone(null);
    setRecent(lastSave.current && Date.now() - lastSave.current.at < UNDO_MS ? lastSave.current : null);
    if (inputRef.current) inputRef.current.focus();
  }
  // Each time the box is shown: what Layers saved last, and a clean box.
  useEffect(() => (bridge && bridge.onShow ? bridge.onShow(reset) : undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);
  // The window is as tall as what's in it.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !bridge || !bridge.resize || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => bridge.resize(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [bridge]);

  function close() { if (bridge && bridge.hide) bridge.hide(); }
  function closeSoon(ms) { clearTimeout(timer.current); timer.current = setTimeout(() => { close(); reset(); }, ms); }
  function save() {
    if (!ready || !bridge) return;
    bridge.submit(r);
    const line = r.kind === 'plan' ? `${r.title} · ${whenText(r)}` : `Logged ${listNames(who)}`;
    lastSave.current = { line, at: Date.now() };
    setDone({ line, undone: false });
    closeSoon(SAVED_MS);
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); reset(); return; }
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // Ctrl+Z: what was just saved, or (in the empty box) the last one.
    const undoable = done ? !done.undone : !text && recent;
    if (ctrl && !e.shiftKey && key === 'z' && undoable && bridge) {
      e.preventDefault();
      bridge.undo();
      setDone({ line: done ? done.line : recent.line, undone: true });
      setRecent(null);
      closeSoon(1500);
      return;
    }
    if (ctrl && (key === 'y' || (e.shiftKey && key === 'z')) && done && done.undone && bridge && bridge.redo) {
      e.preventDefault();
      bridge.redo();
      setDone(d => ({ ...d, undone: false }));
      closeSoon(SAVED_MS);
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (r && bridge) { bridge.open(r); reset(); } return; }
    if (e.key === 'Enter') { e.preventDefault(); if (!done) save(); }
  }

  return (
    <div className={`layers-root${dark ? ' dark' : ''}`} style={{ background: COLORS.paperRaised, minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div ref={rootRef} className="quick-box" role="dialog" aria-label="Quick add">
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <Sparkles size={18} color={COLORS.accent} className="shrink-0" />
          <input ref={inputRef} autoFocus value={text} readOnly={!!done} onChange={e => setText(e.target.value)} onKeyDown={onKeyDown}
            aria-label="Plan or log" placeholder="coffee w Priya fri 10am · log Sam deep" className="quick-input flex-1 min-w-0 text-base"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: COLORS.ink }} />
          <Kbd>Esc</Kbd>
        </div>

        <div className="px-4 py-3" role="status" aria-label="Preview">
          {done ? (
            <p className="text-sm flex items-center gap-2" style={{ color: COLORS.ink }}>
              <Check size={16} color={COLORS.good} strokeWidth={3} className="shrink-0" />
              {done.undone ? <span><b>Undone</b> <span style={{ color: COLORS.inkSoft }}>· <Kbd>Ctrl</Kbd><Kbd>Y</Kbd> redo</span></span> : <span><b>Saved:</b> {done.line} <span style={{ color: COLORS.inkSoft }}>· <Kbd>Ctrl</Kbd><Kbd>Z</Kbd> undo</span></span>}
            </p>
          ) : !r ? (
            <div className="text-xs flex flex-col gap-1" style={{ color: COLORS.inkSoft }}>
              {recent && <p className="mb-1" style={{ color: COLORS.ink }}>Just saved: {recent.line} · <Kbd>Ctrl</Kbd><Kbd>Z</Kbd> undo</p>}
              <p>Type a plan, like <b style={{ color: COLORS.ink }}>movie w Sam sat 7pm</b> or <b style={{ color: COLORS.ink }}>gym every mon wed 7am</b>,</p>
              <p>or a log, like <b style={{ color: COLORS.ink }}>log Priya deep</b> or <b style={{ color: COLORS.ink }}>called Alex yesterday good</b>.</p>
              <p className="mt-1">Ctrl+Alt+L brings Layers to the front, and sends it back again.</p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              {r.kind === 'plan' ? <CalendarPlus size={18} color={COLORS.accent} className="shrink-0" style={{ marginTop: 1 }} /> : <PenLine size={18} color={COLORS.accent} className="shrink-0" style={{ marginTop: 1 }} />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold" style={{ color: COLORS.accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{r.kind === 'plan' ? 'Plan' : 'Log'}</p>
                {r.kind === 'plan' ? (
                  <>
                    <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{r.title}</p>
                    {!r.missing.includes('when') && <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{whenText(r)}</p>}
                    {who.length > 0 && <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>With {listNames(who)}</p>}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{who.length ? listNames(who) : 'Nobody yet'}</p>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{formatCalendarDate(parseISODay(r.day))}{r.meaningfulness ? ` · ${RATING_LABELS[r.meaningfulness - 1]}` : ''}{r.note ? ` · ${r.note}` : ''}</p>
                  </>
                )}
                {r.unknown.length > 0 && <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Not in Layers: {r.unknown.join(', ')} (kept in the title)</p>}
                {r.missing.map(m => <p key={m} className="text-xs mt-1 font-semibold" style={{ color: COLORS.warn }}>{MISSING_TEXT[m]}</p>)}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-3 text-xs flex items-center gap-1 flex-wrap" style={{ color: COLORS.inkSoft }}>
          <Kbd>↵</Kbd> save · <Kbd>Ctrl</Kbd><Kbd>↵</Kbd> open in Layers instead
        </div>
      </div>
    </div>
  );
}
