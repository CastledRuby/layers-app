// "Coach tips" for one plan (planTips in lib/tips.js): for the kind of plan,
// for each person from what's saved about them, their key dates around it,
// and the goal it moves. Opened with T from the day popup or the plan.
// Keys: P opens Prepare in Coach for the first person.

import { CalendarHeart, Lightbulb, Target } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTyping } from '../components/sheetLayer.js';
import { Avatar, Kbd } from '../components/atoms.jsx';
import { getLayer } from '../data/constants.js';
import { planTips } from '../lib/tips.js';
import { COLORS } from '../theme.js';

const whenText = (n) => (n === 0 ? 'that day' : n === 1 ? 'the day after' : `${n} days after`);

function Heading({ children }) {
  return <div className="text-xs font-bold mt-5 mb-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{children}</div>;
}

export function PlanTipsSheet({ ev, day, people, journal, generalGoals, onClose, onPrepare }) {
  const tips = planTips(ev, { people, journal, generalGoals }, day);
  const first = tips.people[0] ? tips.people[0].person : null;

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if ((e.key === 'p' || e.key === 'P') && first && onPrepare) { e.preventDefault(); onPrepare(first.id); }
  }

  return (
    <Sheet title={`Coach: ${ev.title}`} onClose={onClose} onKey={onKey} tall
      footer={first && onPrepare ? <button type="button" onClick={() => onPrepare(first.id)} className="primary-btn">Prepare to talk with {first.name} <Kbd onAccent>P</Kbd></button> : null}>
      <Heading><span aria-hidden="true">{tips.activity.emoji}</span> For a {tips.activity.label.toLowerCase()}</Heading>
      <ul className="flex flex-col gap-1.5">
        {tips.activity.tips.map(t => (
          <li key={t} className="text-sm flex items-start gap-2" style={{ color: COLORS.ink }}><Lightbulb size={14} color={COLORS.accent} className="shrink-0" style={{ marginTop: 3 }} />{t}</li>
        ))}
      </ul>

      {tips.people.map(({ person, hooks, dates, lighter }) => (
        <div key={person.id}>
          <Heading><Avatar emoji={person.emoji} size={20} ringColor={getLayer(person.layer).color} /> {person.name}</Heading>
          {hooks.length === 0 && dates.length === 0 && (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nothing saved about {person.name} yet. When you log, add what you talked about, and it shows up here.</p>
          )}
          <div className="flex flex-col gap-2">
            {hooks.map(h => (
              <div key={h.key} className="rounded-2xl px-3 py-2.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>{h.label}</p>
                <p className="text-sm mt-0.5" style={{ color: COLORS.ink }}>{h.text}</p>
              </div>
            ))}
            {dates.map(d => (
              <p key={d.label} className="text-sm flex items-center gap-2" style={{ color: COLORS.ink }}><CalendarHeart size={14} color={COLORS.layer4} className="shrink-0" />{d.label}: {whenText(d.inDays)}</p>
            ))}
            {lighter && <p className="text-xs" style={{ color: COLORS.inkSoft }}>You're still getting to know {person.name}: interests, plans and what they've been up to suit best. Personal topics come as you get closer.</p>}
          </div>
        </div>
      ))}

      {tips.goal && (
        <>
          <Heading><Target size={13} /> Your goal</Heading>
          <p className="text-sm" style={{ color: COLORS.ink }}>This plan moves <b>{tips.goal.title}</b>.{tips.goal.tip ? ` ${tips.goal.tip}` : ''}</p>
        </>
      )}
    </Sheet>
  );
}
