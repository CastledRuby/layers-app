// "Your week": the weekly review, from Sunday evening's notification, the
// catch-up list's notification, Today's Sunday card or W on Today. Who you
// saw, what got done and which goals moved, chats from your exports with new
// conversations to analyse (chatExports, once there's a key; onAnalyseAll
// opens Coach's Analyse all new), Claude's read of the week (onAnalyse, once
// there's a key: asked by itself for this week, once, within the monthly
// limit; a button for earlier weeks; lib/weekRead.js), then who to
// catch up with and next week planned in one go.
// Keys: 1-5 plan with someone to catch up with, Enter plans next week, and
// the arrows move a week back or on.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { AvatarStack } from '../components/PersonPick.jsx';
import { planIdeas, templateFor, weekSummary } from '../lib/calendar.js';
import { chatRows, loadChatExports, readChatProgress, sourceLabel } from '../lib/chatImport.js';
import { MONTH_NAMES, parseISODay, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
import { recordSpend, spendSummary } from '../lib/analysis.js';
import { readLimit } from '../lib/chatBatch.js';
import { readWeekReads, saveWeekRead, weekReadRequest, weekReadResult } from '../lib/weekRead.js';
import { COLORS } from '../theme.js';

const addDays = (iso, n) => { const d = parseISODay(iso); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const short = (iso) => { const d = parseISODay(iso); return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`; };

function Stat({ value, label, children }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>{value}</span>
        {children}
      </div>
      <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{label}</p>
    </div>
  );
}

export function WeekReviewSheet({ day: startDay, people, journal, events, generalGoals, onClose, onPlan, chatExports = null, yourName = '', onOpenChat, onAnalyseAll, onAnalyse = null }) {
  const [day, setDay] = useState(startDay);
  // Chats with new conversations, from the Layers chats folder.
  const [chats, setChats] = useState([]);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (!chatExports) return undefined;
    let live = true;
    loadChatExports(chatExports).then(r => { if (live) setChats(r.chats); }).catch(() => {});
    return () => { live = false; };
  }, [chatExports]);
  const toAnalyse = useMemo(() => chatRows(chats, { people, yourName, progress: readChatProgress(), now }).filter(r => r.ids.length && r.fresh.length).slice(0, 5), [chats, people, yourName, now]);
  const week = useMemo(() => weekSummary({ people, journal, events, generalGoals }, day), [people, journal, events, generalGoals, day]);
  const ideas = useMemo(() => planIdeas({ people, journal, events }, parseISODay(week.nextMonday), 5), [people, journal, events, week.nextMonday]);
  // Claude's read of the week: kept per week; this week's asked for by itself.
  const [reads, setReads] = useState(() => readWeekReads());
  const [reading, setReading] = useState(null); // the week being read
  const [readError, setReadError] = useState(null);
  const asked = useRef(new Set());
  const read = reads[week.from] ? reads[week.from].read : null;
  const hasLogs = journal.some(j => j.at >= week.from && j.at <= week.to);
  async function readWeek(from, to) {
    const built = weekReadRequest({ from, to, people, journal, quiet: ideas, yourName });
    if (!built || !onAnalyse) return;
    asked.current.add(from);
    setReading(from); setReadError(null);
    const answer = await Promise.resolve(onAnalyse(built.request)).catch(() => null);
    if (answer && answer.usage) recordSpend(answer.usage, answer.model || built.request.model);
    setReading(r => (r === from ? null : r));
    if (!answer || answer.error || !answer.result) { setReadError((answer && answer.error) || "Couldn't read the week."); return; }
    setReads(saveWeekRead(from, weekReadResult(answer.result, built.who)));
  }
  useEffect(() => {
    const today = toISODate(new Date());
    const limit = readLimit();
    if (!onAnalyse || read || !hasLogs || asked.current.has(week.from) || today < week.from || today > week.to) return;
    if (limit && spendSummary().thisMonth.dollars >= limit) return; // asked by itself, so held to the monthly limit
    asked.current.add(week.from); // once, even if this runs again before it starts
    const { from, to } = week;
    queueMicrotask(() => readWeek(from, to));
  });
  const planNextWeek = () => onPlan({ day: week.nextMonday });
  const planWith = (idea) => onPlan({ day: week.nextMonday, personIds: [idea.person.id], template: idea.template });

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const num = /^[1-5]$/.test(e.key) ? Number(e.key) : null;
    if (num && ideas[num - 1]) { e.preventDefault(); planWith(ideas[num - 1]); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setDay(d => addDays(d, -7)); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setDay(d => addDays(d, 7)); }
    else if (e.key === 'Enter') { e.preventDefault(); planNextWeek(); }
  }

  return (
    <Sheet title="Your week" onClose={onClose} onKey={onKey} tall
      footer={<button type="button" onClick={planNextWeek} className="primary-btn">Plan next week <Kbd onAccent>↵</Kbd></button>}>
      <div className="flex items-center gap-1 -mt-2 mb-3">
        <button type="button" onClick={() => setDay(d => addDays(d, -7))} aria-label="Week before" className="icon-btn -ml-2"><ChevronLeft size={18} color={COLORS.inkSoft} /></button>
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>{short(week.from)} to {short(week.to)}</p>
        <button type="button" onClick={() => setDay(d => addDays(d, 7))} aria-label="Week after" className="icon-btn"><ChevronRight size={18} color={COLORS.inkSoft} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat value={week.seen.length} label={week.seen.length === 1 ? 'person seen' : 'people seen'}>{week.seen.length > 0 && <AvatarStack people={week.seen} size={22} />}</Stat>
        <Stat value={week.logs} label={week.logs === 1 ? 'interaction logged' : 'interactions logged'} />
        <Stat value={`${week.done} of ${week.planned}`} label="plans done" />
        <Stat value={week.goalsMoved.length} label={week.goalsMoved.length === 1 ? 'goal moved' : 'goals moved'} />
      </div>

      {onAnalyse && hasLogs && (
        <div aria-label="Claude's read of your week">
          <p className="text-xs font-bold mt-6 mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Claude's read</p>
          {read ? (
            <div className="rounded-2xl p-3.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              {read.headline && <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{read.headline}</p>}
              {[['wentWell', 'Went well'], ['pattern', 'A pattern'], ['tryThisWeek', 'Try this week'], ['reachOut', 'Reach out']].filter(([k]) => read[k]).map(([k, label]) => (
                <p key={k} className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}><span className="font-semibold" style={{ color: COLORS.ink }}>{label}:</span> {read[k]}</p>
              ))}
              <p className="text-xs mt-2 italic" style={{ color: COLORS.inkSoft }}>A coach's view of what you logged, not facts.</p>
            </div>
          ) : reading === week.from ? (
            <p className="text-xs italic" role="status" style={{ color: COLORS.inkSoft }}>Claude is reading your week…</p>
          ) : (
            <button type="button" onClick={() => readWeek(week.from, week.to)} className="chip">Read this week with Claude</button>
          )}
          {readError && !read && <p className="text-xs mt-1.5 font-semibold" role="alert" style={{ color: COLORS.alert }}>{readError}</p>}
        </div>
      )}

      {toAnalyse.length > 0 && onOpenChat && (
        <>
          <div className="flex items-center justify-between gap-2 mt-6 mb-2">
            <p className="text-xs font-bold" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Chats to analyse</p>
            {onAnalyseAll && <button type="button" onClick={onAnalyseAll} className="text-xs font-semibold" style={{ color: COLORS.accent }}>Analyse them all in Coach</button>}
          </div>
          <div className="flex flex-col gap-1.5">
            {toAnalyse.map(({ chat, ids, fresh }) => (
              <button key={chat.key} type="button" onClick={() => onOpenChat(chat.key)} className="flex items-center gap-3 rounded-2xl p-2.5 text-left" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <AvatarStack people={ids.map(id => people.find(p => p.id === id)).filter(Boolean)} size={30} />
                <span className="text-sm flex-1 min-w-0" style={{ color: COLORS.ink }}>{chat.title} <span style={{ color: COLORS.inkSoft }}>· {sourceLabel(chat.source)}</span></span>
                <span className="text-xs font-semibold shrink-0" style={{ color: COLORS.accent }}>{fresh.length} new {fresh.length === 1 ? 'conversation' : 'conversations'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {ideas.length > 0 && (
        <>
          <p className="text-xs font-bold mt-6 mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Catch up next week</p>
          <div className="flex flex-col gap-1.5">
            {ideas.map((idea, i) => (
              <div key={idea.person.id} className="flex items-center gap-3 rounded-2xl p-2.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <AvatarStack people={[idea.person]} size={30} />
                <p className="text-sm flex-1 min-w-0" style={{ color: COLORS.ink }}>{idea.text}</p>
                <button type="button" onClick={() => planWith(idea)} className="chip shrink-0">Plan {templateFor(idea.template).label.toLowerCase()} <Kbd>{i + 1}</Kbd></button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-sm mt-6" style={{ color: COLORS.inkSoft }}>
        Next week so far: {week.nextPlanned === 0 ? 'nothing planned' : `${week.nextPlanned} ${week.nextPlanned === 1 ? 'plan' : 'plans'}`}. Plan next week opens planning on {short(week.nextMonday)}; <b>Save + another</b> (Shift+Enter) adds the rest.
      </p>
    </Sheet>
  );
}
