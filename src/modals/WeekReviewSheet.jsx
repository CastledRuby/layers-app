// "Your week": the weekly review, from Sunday evening's notification, the
// catch-up list's notification, Today's Sunday card or W on Today. Who you
// saw, what got done and which goals moved, then who to catch up with and
// next week planned in one go.
// Keys: 1-5 plan with someone to catch up with, Enter plans next week, and
// the arrows move a week back or on.

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { AvatarStack } from '../components/PersonPick.jsx';
import { planIdeas, templateFor, weekSummary } from '../lib/calendar.js';
import { MONTH_NAMES, parseISODay, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
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

export function WeekReviewSheet({ day: startDay, people, journal, events, generalGoals, onClose, onPlan }) {
  const [day, setDay] = useState(startDay);
  const week = useMemo(() => weekSummary({ people, journal, events, generalGoals }, day), [people, journal, events, generalGoals, day]);
  const ideas = useMemo(() => planIdeas({ people, journal, events }, parseISODay(week.nextMonday), 5), [people, journal, events, week.nextMonday]);
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
