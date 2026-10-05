// Log an interaction. A step machine; see docs/renderer/app-structure.md.
// "Plan something" on the first step hands over to the calendar's PlanSheet.
//
// The quick log (the details step) asks only for the date, how meaningful it
// was and a note. Everything else is optional and opens in its own small
// sheet (LogDetailSheets.jsx), one thing at a time. Every step can be driven
// from the keyboard; the keys are shown next to what they do.

import { useRef, useState } from 'react';
import { Calendar, Check, Ear, Gauge, MessageCircle, PenLine, Plus, Sparkles, Target, X } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Avatar, KeyedField, Kbd } from '../components/atoms.jsx';
import { DateDropdown } from '../components/pickers.jsx';
import { PeopleGrid } from '../components/PersonPick.jsx';
import { usePeopleKeys } from '../components/peopleKeys.js';
import { categoryMeta, DIM_ORDER, getLayer, NOTE_TEMPLATE_CATEGORY, TYPE_META, TYPE_ORDER } from '../data/constants.js';
import { parseISODay } from '../lib/dates.js';
import { GoalsSheet, ListeningSheet, NewInfoSheet, RateSheet, ReflectionSheet } from './LogDetailSheets.jsx';
import { QuickGoalSheet } from './QuickGoalSheet.jsx';
import { TemplatePickerModal } from './TemplatePickerModal.jsx';
import { COLORS } from '../theme.js';

const ML_LABELS = ['Very brief', 'Casual', 'Good conversation', 'Personal', 'Deep conversation'];

// Step order, so moving forward slides in from the right and back from the left.
const STEP_ORDER = ['kind', 'type', 'who', 'details'];

// The quick log's title says what's being logged: "Talked with Ana".
const DETAIL_TITLE = { talked: 'Talked with', activity: 'Activity with', messaged: 'Messaged', hangout: 'Hung out with', called: 'Called', other: 'Time with' };
function namesText(names) {
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

function SectionLabel({ children, extra }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{children}</p>
      {extra}
    </div>
  );
}
const optional = <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span>;

function Scale({ value, onChange, label, size = 'md' }) {
  return (
    <div className={`seg${size === 'sm' ? ' seg--sm' : ''}`} role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n} className={`seg-btn${value === n ? ' seg-btn--on pop' : ''}`}>{n}</button>
      ))}
    </div>
  );
}

// prefill (logging a plan from the calendar, or a log typed in Ctrl+K):
// { personIds, type, note, day, goalIds, meaningfulness } opens straight on
// the details, filled in; goalIds, when given, are the only goals ticked.
export function LogInteractionModal({ people, defaultPersonId, prefill, onClose, onSubmit, onPlan, onCreateGoal }) {
  // Only preselect someone who still exists (Coach can pass a removed person).
  const startPerson = defaultPersonId && people.some(p => p.id === defaultPersonId) ? defaultPersonId : null;
  // With someone already picked (their profile, Ctrl+K), it's an interaction,
  // so it starts at what you did (Backspace still reaches "Plan something").
  const [step, setStep] = useState(prefill ? 'details' : startPerson ? 'type' : 'kind'); // kind -> type -> who -> details
  const [dir, setDir] = useState(null); // 'in' | 'back': the slide for the step just shown
  const [type, setType] = useState(prefill ? prefill.type || 'other' : null);
  const [personIds, setPersonIds] = useState(() => prefill ? (prefill.personIds || []).filter(id => people.some(p => p.id === id)) : startPerson ? [startPerson] : []);
  const [meaningfulness, setMeaningfulness] = useState(() => (prefill && prefill.meaningfulness) || 3);
  const [al, setAl] = useState([]);
  const [quickNote, setQuickNote] = useState(prefill && prefill.note ? prefill.note : '');
  const [quickNoteTags, setQuickNoteTags] = useState([]);
  const [noteTemplatesOpen, setNoteTemplatesOpen] = useState(false);
  const [logDate, setLogDate] = useState(() => (prefill && prefill.day ? parseISODay(prefill.day) : new Date()));
  const noteRef = useRef(null);
  // "More details": which of their sheets is open (null = none), and what's in them.
  const [extra, setExtra] = useState(null); // 'rate' | 'listening' | 'new' | 'goals' | 'reflect'
  const [newGoal, setNewGoal] = useState(false); // QuickGoalSheet, over Goals moved
  const [newInfo, setNewInfo] = useState([]); // [{ category, text }]
  const [newInfoCat, setNewInfoCat] = useState('interests');
  const [newInfoText, setNewInfoText] = useState('');
  // A 1-5 rating per dimension (keys of DIM_ORDER), and the row that typing
  // a number fills next (DIM_ORDER.length = past the last row).
  const [ratings, setRatings] = useState({});
  const [ratingCursor, setRatingCursor] = useState(0);
  const [untickedGoals, setUntickedGoals] = useState(() => {
    if (!prefill || !prefill.goalIds) return [];
    return people.filter(p => (prefill.personIds || []).includes(p.id)).flatMap(p => p.goals.filter(g => g.progress < 100).map(g => g.id)).filter(id => !prefill.goalIds.includes(id));
  });
  const [reflection, setReflection] = useState('');
  const [reflectionTags, setReflectionTags] = useState([]); // phrases picked in "How did it feel?"

  function go(next) {
    setDir(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 'in' : 'back');
    setStep(next);
  }
  const BACK = { type: 'kind', who: 'type', details: 'who' };
  function goBack() {
    if (!BACK[step]) return;
    go(BACK[step]);
  }

  function toggleIn(setter, key) { setter(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]); }
  function togglePerson(id) { toggleIn(setPersonIds, id); }
  const peopleKeys = usePeopleKeys(people, personIds, togglePerson);
  function pickType(key) { setType(key); go('who'); }
  const canSave = personIds.length > 0 && type;
  const loggedPeople = personIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  // Topics picked with "+ Add detail" are also saved on the person's profile
  // (NOTE_TEMPLATE_CATEGORY says where) when the log is with one person; a
  // group log keeps them in its note only. They used to reach only the note.
  const profileNotes = personIds.length === 1
    ? quickNoteTags.filter(t => NOTE_TEMPLATE_CATEGORY[t.cat]).map(t => ({ category: NOTE_TEMPLATE_CATEGORY[t.cat], text: t.text, emoji: t.emoji }))
    : [];
  const loggedPerson = personIds.length === 1 ? loggedPeople[0] : null;
  // Every active goal of the people in this log moves unless you untick it.
  const goalsInLog = loggedPeople.flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ id: g.id, title: g.title, personName: p.name })));
  function handleSave() {
    if (!canSave) return;
    const combined = [...quickNoteTags.map(t => t.text), quickNote.trim()].filter(Boolean).join(', ');
    const notes = [...profileNotes, ...(loggedPerson ? newInfo.map(n => ({ ...n, emoji: n.emoji || categoryMeta(n.category).emoji })) : [])];
    const reflectionText = [...reflectionTags, reflection.trim()].filter(Boolean).join('. ');
    onSubmit({
      personIds, type, meaningfulness, notes, activeListening: al, summary: combined || undefined, pickedDate: logDate,
      ratings,
      goalIds: untickedGoals.length > 0 ? goalsInLog.map(g => g.id).filter(id => !untickedGoals.includes(id)) : undefined,
      reflection: reflectionText || undefined,
    });
  }

  // The optional extras, each with its own sheet and key. What's filled in
  // shows on its chip, so the quick log says what's been added at a glance.
  const rated = DIM_ORDER.filter(k => ratings[k]).length;
  const extras = [
    { key: 'rate', letter: 'R', Icon: Gauge, label: 'Rate each part', summary: rated ? `${rated} of ${DIM_ORDER.length}` : null },
    { key: 'listening', letter: 'L', Icon: Ear, label: 'Active listening', summary: al.length ? `${al.length} ticked` : null },
    loggedPerson && { key: 'new', letter: 'I', Icon: Sparkles, label: 'Something new', summary: newInfo.length ? `${newInfo.length} added` : null },
    (goalsInLog.length > 0 || (onCreateGoal && loggedPeople.length > 0)) && { key: 'goals', letter: 'G', Icon: Target, label: goalsInLog.length ? 'Goals moved' : 'Add a goal', summary: untickedGoals.length ? `${goalsInLog.length - untickedGoals.length} of ${goalsInLog.length}` : null },
    { key: 'reflect', letter: 'F', Icon: PenLine, label: 'How it felt', summary: reflectionTags.length ? `${reflectionTags.length} picked${reflection.trim() ? ', written' : ''}` : reflection.trim() ? 'written' : null },
  ].filter(Boolean);

  // Keys, while this sheet is on top (not while one of its pickers is):
  //   every step  Backspace goes back
  //   kind        1 Interaction, 2 Plan something    type  1-6 the types
  //   who         1-9 or typing a name picks people (peopleKeys.js), Enter confirms
  //   details     1-5 how meaningful, N the note, D Add detail, R/L/I/G/F
  //               the extras, Enter (or Ctrl+Enter, even in the note) saves
  // Enter on a button reached with Tab presses that button instead.
  function handleKey(e) {
    if (e.metaKey || e.altKey) return;
    if (e.ctrlKey) {
      if (e.key === 'Enter' && step === 'details') { e.preventDefault(); handleSave(); }
      return;
    }
    if (isTyping()) return;
    const key = e.key;
    if (step === 'who' && !(key === 'Enter' && isTabbedToButton()) && peopleKeys.handleKey(e)) return;
    if (key === 'Backspace' && BACK[step]) { e.preventDefault(); goBack(); return; }
    if (key === 'Enter' && isTabbedToButton()) return;
    const num = /^[1-9]$/.test(key) ? Number(key) : null;
    const letter = key.length === 1 ? key.toLowerCase() : null;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (step === 'kind') {
      if (num === 1 && people.length > 0) act(() => go('type'));
      else if (num === 2 && onPlan) act(onPlan);
    } else if (step === 'type') {
      if (num && num <= TYPE_ORDER.length) act(() => pickType(TYPE_ORDER[num - 1]));
    } else if (step === 'who') {
      if (key === 'Enter' && personIds.length > 0) act(() => go('details'));
    } else if (step === 'details') {
      if (num && num <= 5) act(() => setMeaningfulness(num));
      else if (key === 'Enter') act(handleSave);
      else if (letter === 'd') act(() => setNoteTemplatesOpen(true));
      else if (letter === 'n') act(() => noteRef.current && noteRef.current.focus());
      else {
        const x = extras.find(item => item.letter.toLowerCase() === letter);
        if (x) act(() => setExtra(x.key));
      }
    }
  }

  const titles = {
    kind: 'What are you logging?',
    type: 'What did you do?',
    who: 'Who was this with?',
    details: type && loggedPeople.length ? `${DETAIL_TITLE[type] || 'With'} ${namesText(loggedPeople.map(p => p.name))}` : 'Add details',
  };
  const footer =
    step === 'who' ? (
      <button type="button" onClick={() => personIds.length > 0 && go('details')} disabled={personIds.length === 0} className="primary-btn">
        Confirm{personIds.length > 0 ? ` (${personIds.length} selected)` : ''}{personIds.length > 0 && <Kbd onAccent>↵</Kbd>}
      </button>
    ) : step === 'details' ? (
      <button type="button" onClick={handleSave} disabled={!canSave} className="primary-btn">Save interaction <Kbd onAccent>↵</Kbd></button>
    ) : null;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={BACK[step] ? goBack : undefined} onKey={handleKey} footer={footer} tall>
      <div key={step} className={dir === 'in' ? 'step-in' : dir === 'back' ? 'step-back' : ''}>
        {step === 'kind' && (
          <div className="grid grid-cols-2 gap-3">
            {/* With nobody in your circle yet, only plans can be made. */}
            <button type="button" onClick={() => go('type')} disabled={people.length === 0} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>1</Kbd>
              <span className="tile-icon"><MessageCircle size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">Interaction</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>{people.length === 0 ? 'Add someone in People first' : 'Something that already happened'}</span>
            </button>
            <button type="button" onClick={onPlan} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>2</Kbd>
              <span className="tile-icon"><Calendar size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">Plan something</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>Something coming up, on your calendar</span>
            </button>
          </div>
        )}

        {step === 'type' && (
          <div className="grid grid-cols-3 gap-2.5">
            {TYPE_ORDER.map((key, i) => {
              const meta = TYPE_META[key];
              return (
                <button key={key} type="button" onClick={() => pickType(key)} className="tile py-5 px-1 flex flex-col items-center gap-2">
                  <Kbd>{i + 1}</Kbd>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{meta.emoji}</span>
                  <span className="text-xs font-semibold text-center">{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {step === 'who' && (
          <>
            <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Tap everyone who was involved, press their number, or type a name. You can pick more than one.</p>
            <PeopleGrid keys={peopleKeys} pickedIds={personIds} />
          </>
        )}

        {step === 'details' && (
          <>
            <div className="flex items-center justify-between gap-3 mb-5">
              <DateDropdown compact value={logDate} onChange={setLogDate} maxDate={new Date()} />
              <div className="flex items-center" aria-hidden="true">
                {loggedPeople.slice(0, 4).map((p, i) => (
                  <span key={p.id} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: `0 0 0 2px ${COLORS.paperRaised}` }}><Avatar person={p} size={30} ringColor={getLayer(p.layer).color} /></span>
                ))}
              </div>
            </div>

            <SectionLabel extra={<span className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Kbd>1</Kbd>–<Kbd>5</Kbd></span>}>How meaningful was it?</SectionLabel>
            <Scale value={meaningfulness} onChange={setMeaningfulness} label="How meaningful was it?" />
            <p key={meaningfulness} className="text-xs font-semibold text-center mt-2 mb-6 fade-anim" style={{ color: COLORS.accent }}>{ML_LABELS[meaningfulness - 1]}</p>

            <SectionLabel extra={
              <button type="button" onClick={() => setNoteTemplatesOpen(true)} className="chip" style={{ padding: '4px 6px 4px 10px' }}><Plus size={13} color={COLORS.accent} />Add detail<Kbd>D</Kbd></button>
            }>Quick note {optional}</SectionLabel>
            {noteTemplatesOpen && (
              <TemplatePickerModal title="Add detail" onClose={() => setNoteTemplatesOpen(false)} onPick={(text, emoji, cat) => setQuickNoteTags(prev => [...prev, { text, emoji, cat }])} />
            )}
            {quickNoteTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                {quickNoteTags.map((tag, i) => (
                  <span key={i} className="chip chip--on chip-in" style={{ paddingRight: 6 }}>
                    {tag.emoji} {tag.text}
                    <button type="button" onClick={() => setQuickNoteTags(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove "${tag.text}"`} className="p-0.5"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <KeyedField letter="N" ref={noteRef} value={quickNote} onChange={e => setQuickNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); handleSave(); } }} aria-label="Quick note" placeholder="e.g. Caught up after school, good chat" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
            {profileNotes.length > 0 && loggedPerson && (
              <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Topics are also saved to {loggedPerson.name}'s profile.</p>
            )}

            <div className="mt-6">
              <SectionLabel>More details {optional}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {extras.map(x => (
                  <button key={x.key} type="button" onClick={() => setExtra(x.key)} aria-label={x.summary ? `${x.label}, ${x.summary}` : x.label} className={`chip${x.summary ? ' chip--on' : ''}`} style={{ padding: '6px 6px 6px 10px' }}>
                    {x.summary ? <Check size={13} color={COLORS.accent} strokeWidth={3} /> : <x.Icon size={14} color={COLORS.accent} />}
                    {x.label}
                    {x.summary && <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>· {x.summary}</span>}
                    <Kbd>{x.letter}</Kbd>
                  </button>
                ))}
              </div>
            </div>

            {extra === 'rate' && <RateSheet ratings={ratings} setRatings={setRatings} cursor={ratingCursor} setCursor={setRatingCursor} onClose={() => setExtra(null)} />}
            {extra === 'listening' && <ListeningSheet al={al} toggle={(k) => toggleIn(setAl, k)} onClose={() => setExtra(null)} />}
            {extra === 'new' && loggedPerson && <NewInfoSheet personName={loggedPerson.name} items={newInfo} setItems={setNewInfo} category={newInfoCat} setCategory={setNewInfoCat} text={newInfoText} setText={setNewInfoText} onClose={() => setExtra(null)} />}
            {extra === 'goals' && <GoalsSheet goals={goalsInLog} unticked={untickedGoals} toggle={(id) => toggleIn(setUntickedGoals, id)} showNames={personIds.length > 1} onNewGoal={onCreateGoal ? () => setNewGoal(true) : undefined} onClose={() => setExtra(null)} />}
            {extra === 'goals' && newGoal && (
              <QuickGoalSheet people={people} forIds={personIds} onClose={() => setNewGoal(false)}
                onCreate={(personId, goal) => { onCreateGoal(personId, goal); setNewGoal(false); }} />
            )}
            {extra === 'reflect' && <ReflectionSheet tags={reflectionTags} toggleTag={(t) => toggleIn(setReflectionTags, t)} value={reflection} setValue={setReflection} onClose={() => setExtra(null)} />}
          </>
        )}

      </div>
    </Sheet>
  );
}
