// Log an interaction, or create/manage saved events. A step machine; see
// docs/renderer/app-structure.md.
//
// The quick log (the details step) asks only for the date, how meaningful it
// was and a note. Everything else is optional and opens in its own small
// sheet (LogDetailSheets.jsx), one thing at a time. Every step can be driven
// from the keyboard; the keys are shown next to what they do.

import { useEffect, useRef, useState } from 'react';
import { Calendar, Check, Clock, Ear, Gauge, MessageCircle, PenLine, Plus, Repeat, Sparkles, Target, X } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Avatar, Kbd } from '../components/atoms.jsx';
import { DateDropdown, TimeDropdown } from '../components/pickers.jsx';
import { categoryMeta, DIM_ORDER, getLayer, NOTE_TEMPLATE_CATEGORY, TYPE_META, TYPE_ORDER } from '../data/constants.js';
import { formatCalendarDate, formatTime12, formatWeekdays, nowToMinutes, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
import { occurrenceToLog } from '../lib/reminders.js';
import { GoalsSheet, ListeningSheet, NewInfoSheet, RateSheet, ReflectionSheet } from './LogDetailSheets.jsx';
import { TemplatePickerModal } from './TemplatePickerModal.jsx';
import { COLORS } from '../theme.js';

const ML_LABELS = ['Very brief', 'Casual', 'Good conversation', 'Personal', 'Deep conversation'];

// Step order, so moving forward slides in from the right and back from the left.
const STEP_ORDER = ['kind', 'type', 'who', 'details', 'eventKind', 'eventChoice', 'eventList', 'eventForm'];

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

function PersonPick({ person, active, onClick, size = 48 }) {
  const l = getLayer(person.layer);
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="flex flex-col items-center gap-1 shrink-0 rounded-2xl py-1.5" style={{ width: 64 }}>
      <span style={{ position: 'relative', display: 'inline-block' }} className={active ? 'pop' : ''}>
        <Avatar emoji={person.emoji} size={size} ringColor={active ? COLORS.accent : l.color} />
        {active && (
          <span style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${COLORS.paperRaised}` }}>
            <Check size={10} color={COLORS.onAccent} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="text-xs truncate" style={{ maxWidth: 60, color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{person.name}</span>
    </button>
  );
}

function Scale({ value, onChange, label, size = 'md' }) {
  return (
    <div className={`seg${size === 'sm' ? ' seg--sm' : ''}`} role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n} className={`seg-btn${value === n ? ' seg-btn--on pop' : ''}`}>{n}</button>
      ))}
    </div>
  );
}

export function LogInteractionModal({ people, defaultPersonId, events, initialStep, initialEditEvent, onClose, onSubmit, onCreateEvent, onUpdateEvent, onDeleteEvent, onMarkEventDone, linkedGoalIds }) {
  const [step, setStep] = useState(initialStep || 'kind'); // kind -> type -> who -> details  |  kind -> eventKind -> eventChoice -> eventForm/eventList
  const [dir, setDir] = useState(null); // 'in' | 'back': the slide for the step just shown
  const [type, setType] = useState(null);
  // Only preselect someone who still exists (Coach can pass a removed person).
  const startPerson = defaultPersonId && people.some(p => p.id === defaultPersonId) ? defaultPersonId : null;
  const [personIds, setPersonIds] = useState(startPerson ? [startPerson] : []);
  const [meaningfulness, setMeaningfulness] = useState(3);
  const [al, setAl] = useState([]);
  const [quickNote, setQuickNote] = useState('');
  const [quickNoteTags, setQuickNoteTags] = useState([]);
  const [noteTemplatesOpen, setNoteTemplatesOpen] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date());
  const noteRef = useRef(null);
  // "More details": which of their sheets is open (null = none), and what's in them.
  const [extra, setExtra] = useState(null); // 'rate' | 'listening' | 'new' | 'goals' | 'reflect'
  const [newInfo, setNewInfo] = useState([]); // [{ category, text }]
  const [newInfoCat, setNewInfoCat] = useState('interests');
  const [newInfoText, setNewInfoText] = useState('');
  // A 1-5 rating per dimension (keys of DIM_ORDER), and the row that typing
  // a number fills next (DIM_ORDER.length = past the last row).
  const [ratings, setRatings] = useState({});
  const [ratingCursor, setRatingCursor] = useState(0);
  const [untickedGoals, setUntickedGoals] = useState([]);
  const [reflection, setReflection] = useState('');

  const [eventKind, setEventKind] = useState(null); // 'recurring' | 'oneoff'
  const [eventTitle, setEventTitle] = useState('');
  const [eventPersonIds, setEventPersonIds] = useState(startPerson ? [startPerson] : []);
  const [eventDate, setEventDate] = useState(() => new Date());
  const [eventWeekdays, setEventWeekdays] = useState([new Date().getDay()]);
  const [eventTime, setEventTime] = useState(() => nowToMinutes());
  const [eventDefaultMeaningfulness, setEventDefaultMeaningfulness] = useState(3);
  const [eventGoalId, setEventGoalId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [logMeaningfulness, setLogMeaningfulness] = useState(3);
  const [logQuickDetailTags, setLogQuickDetailTags] = useState([]);
  const [logTemplatesOpen, setLogTemplatesOpen] = useState(false);

  function go(next) {
    setDir(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 'in' : 'back');
    setStep(next);
  }
  const BACK = { type: 'kind', who: 'type', details: 'who', eventKind: 'kind', eventChoice: 'eventKind', eventList: 'eventChoice', eventForm: editingEventId ? 'eventList' : 'eventChoice' };
  function goBack() {
    if (!BACK[step]) return;
    if (step === 'eventList') setSelectedExisting(null);
    go(BACK[step]);
  }

  function toggleIn(setter, key) { setter(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]); }
  function togglePerson(id) { toggleIn(setPersonIds, id); }
  function toggleEventPerson(id) { toggleIn(setEventPersonIds, id); }
  function toggleEventWeekday(i) { setEventWeekdays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a, b) => a - b)); }
  function pickType(key) { setType(key); go('who'); }
  function openEditEvent(ev) {
    setEditingEventId(ev.id);
    setEventKind(ev.kind);
    setEventTitle(ev.title);
    setEventPersonIds(ev.personIds || []);
    setEventDate(ev.date ? new Date(ev.date + 'T00:00:00') : new Date());
    setEventWeekdays(ev.weekdays || (ev.weekday != null ? [ev.weekday] : [new Date().getDay()]));
    setEventTime(ev.time != null ? ev.time : nowToMinutes());
    setEventDefaultMeaningfulness(ev.defaultMeaningfulness || 3);
    setEventGoalId(ev.goalId || null);
    go('eventForm');
  }
  function startNewEvent() {
    setEditingEventId(null); setEventTitle(''); setEventPersonIds(defaultPersonId ? [defaultPersonId] : []); setEventDate(new Date());
    setEventWeekdays([new Date().getDay()]); setEventTime(nowToMinutes()); setEventDefaultMeaningfulness(3); setEventGoalId(null);
    go('eventForm');
  }

  // Lets Home's "Manage recurring" section jump straight into editing a
  // specific event, bypassing kind/eventKind/eventChoice entirely.
  useEffect(() => {
    if (initialEditEvent) openEditEvent(initialEditEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const notes = [...profileNotes, ...(loggedPerson ? newInfo.map(n => ({ ...n, emoji: categoryMeta(n.category).emoji })) : [])];
    onSubmit({
      personIds, type, meaningfulness, notes, activeListening: al, summary: combined || undefined, pickedDate: logDate,
      ratings,
      goalIds: untickedGoals.length > 0 ? goalsInLog.map(g => g.id).filter(id => !untickedGoals.includes(id)) : undefined,
      reflection: reflection.trim() || undefined,
    });
  }

  // The optional extras, each with its own sheet and key. What's filled in
  // shows on its chip, so the quick log says what's been added at a glance.
  const rated = DIM_ORDER.filter(k => ratings[k]).length;
  const extras = [
    { key: 'rate', letter: 'R', Icon: Gauge, label: 'Rate each part', summary: rated ? `${rated} of ${DIM_ORDER.length}` : null },
    { key: 'listening', letter: 'L', Icon: Ear, label: 'Active listening', summary: al.length ? `${al.length} ticked` : null },
    loggedPerson && { key: 'new', letter: 'I', Icon: Sparkles, label: 'Something new', summary: newInfo.length ? `${newInfo.length} added` : null },
    goalsInLog.length > 0 && { key: 'goals', letter: 'G', Icon: Target, label: 'Goals moved', summary: untickedGoals.length ? `${goalsInLog.length - untickedGoals.length} of ${goalsInLog.length}` : null },
    { key: 'reflect', letter: 'F', Icon: PenLine, label: 'How it felt', summary: reflection.trim() ? 'written' : null },
  ].filter(Boolean);

  const canSaveEvent = eventTitle.trim().length > 0 && (eventKind !== 'recurring' || eventWeekdays.length > 0);
  // A reminder can be linked to one active goal of the people it's about;
  // logging it then moves that goal (and only that one).
  const eventGoals = people.filter(p => eventPersonIds.includes(p.id)).flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ id: g.id, title: g.title, personName: p.name })));
  function handleSaveEvent() {
    if (!canSaveEvent) return;
    const payload = {
      title: eventTitle.trim(),
      personIds: eventPersonIds,
      kind: eventKind,
      date: eventKind === 'oneoff' ? toISODate(eventDate) : null,
      weekdays: eventKind === 'recurring' ? eventWeekdays : null,
      time: eventTime,
      defaultMeaningfulness: eventDefaultMeaningfulness,
      goalId: eventGoals.some(g => g.id === eventGoalId) ? eventGoalId : null,
    };
    if (editingEventId) onUpdateEvent(editingEventId, payload);
    else onCreateEvent(payload);
    onClose();
  }

  const existingOfKind = (events || []).filter(e => e.kind === eventKind);

  // Keys, while this sheet is on top (not while one of its pickers is):
  //   every step  Backspace goes back
  //   kind        1 Interaction, 2 Event       type  1-6 the types
  //   who         Enter confirms
  //   details     1-5 how meaningful, N the note, D Add detail, R/L/I/G/F
  //               the extras, Enter (or Ctrl+Enter, even in the note) saves
  //   eventKind   1 One-off, 2 Recurring       eventChoice  1 New, 2 Saved
  // Enter on a button reached with Tab presses that button instead.
  function handleKey(e) {
    if (e.metaKey || e.altKey) return;
    if (e.ctrlKey) {
      if (e.key === 'Enter' && step === 'details') { e.preventDefault(); handleSave(); }
      return;
    }
    if (isTyping()) return;
    const key = e.key;
    if (key === 'Backspace' && BACK[step]) { e.preventDefault(); goBack(); return; }
    if (key === 'Enter' && isTabbedToButton()) return;
    const num = /^[1-9]$/.test(key) ? Number(key) : null;
    const letter = key.length === 1 ? key.toLowerCase() : null;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (step === 'kind') {
      if (num === 1 && people.length > 0) act(() => go('type'));
      else if (num === 2) act(() => go('eventKind'));
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
    } else if (step === 'eventKind') {
      if (num === 1) act(() => { setEventKind('oneoff'); go('eventChoice'); });
      else if (num === 2) act(() => { setEventKind('recurring'); go('eventChoice'); });
    } else if (step === 'eventChoice') {
      if (num === 1) act(startNewEvent);
      else if (num === 2 && existingOfKind.length > 0) act(() => go('eventList'));
    }
  }

  const titles = {
    kind: 'What are you logging?',
    type: 'What did you do?',
    who: 'Who was this with?',
    details: type && loggedPeople.length ? `${DETAIL_TITLE[type] || 'With'} ${namesText(loggedPeople.map(p => p.name))}` : 'Add details',
    eventKind: 'Recurring or one-off?',
    eventChoice: 'Create new or choose existing?',
    eventForm: editingEventId ? 'Edit event' : (eventKind === 'recurring' ? 'New recurring event' : 'New one-off event'),
    eventList: 'Your saved events',
  };
  const footer =
    step === 'who' ? (
      <button type="button" onClick={() => personIds.length > 0 && go('details')} disabled={personIds.length === 0} className="primary-btn">
        Confirm{personIds.length > 0 ? ` (${personIds.length} selected)` : ''}{personIds.length > 0 && <Kbd onAccent>↵</Kbd>}
      </button>
    ) : step === 'details' ? (
      <button type="button" onClick={handleSave} disabled={!canSave} className="primary-btn">Save interaction <Kbd onAccent>↵</Kbd></button>
    ) : step === 'eventForm' ? (
      <button type="button" onClick={handleSaveEvent} disabled={!canSaveEvent} className="primary-btn">{editingEventId ? 'Save changes' : `Save ${eventKind === 'recurring' ? 'recurring event' : 'event'}`}</button>
    ) : null;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={BACK[step] ? goBack : undefined} onKey={handleKey} footer={footer} tall>
      <div key={step} className={dir === 'in' ? 'step-in' : dir === 'back' ? 'step-back' : ''}>
        {step === 'kind' && (
          <div className="grid grid-cols-2 gap-3">
            {/* With nobody in your circle yet, only events can be made. */}
            <button type="button" onClick={() => go('type')} disabled={people.length === 0} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>1</Kbd>
              <span className="tile-icon"><MessageCircle size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">Interaction</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>{people.length === 0 ? 'Add someone in People first' : 'Something that already happened'}</span>
            </button>
            <button type="button" onClick={() => go('eventKind')} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>2</Kbd>
              <span className="tile-icon"><Calendar size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">Event</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>Something upcoming or recurring</span>
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
            <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Tap everyone who was involved. You can pick more than one.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 8, paddingBottom: 4 }}>
              {people.map(p => <PersonPick key={p.id} person={p} active={personIds.includes(p.id)} onClick={() => togglePerson(p.id)} />)}
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <div className="flex items-center justify-between gap-3 mb-5">
              <DateDropdown compact value={logDate} onChange={setLogDate} maxDate={new Date()} />
              <div className="flex items-center" aria-hidden="true">
                {loggedPeople.slice(0, 4).map((p, i) => (
                  <span key={p.id} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: `0 0 0 2px ${COLORS.paperRaised}` }}><Avatar emoji={p.emoji} size={30} ringColor={getLayer(p.layer).color} /></span>
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
            <input ref={noteRef} value={quickNote} onChange={e => setQuickNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); handleSave(); } }} aria-label="Quick note" placeholder="e.g. Caught up after school, good chat" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
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
            {extra === 'goals' && <GoalsSheet goals={goalsInLog} unticked={untickedGoals} toggle={(id) => toggleIn(setUntickedGoals, id)} showNames={personIds.length > 1} onClose={() => setExtra(null)} />}
            {extra === 'reflect' && <ReflectionSheet value={reflection} setValue={setReflection} onClose={() => setExtra(null)} />}
          </>
        )}

        {step === 'eventKind' && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setEventKind('oneoff'); go('eventChoice'); }} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>1</Kbd>
              <span className="tile-icon"><Calendar size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">One-off</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>A single upcoming thing</span>
            </button>
            <button type="button" onClick={() => { setEventKind('recurring'); go('eventChoice'); }} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>2</Kbd>
              <span className="tile-icon"><Repeat size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">Recurring</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>Repeats weekly</span>
            </button>
          </div>
        )}

        {step === 'eventChoice' && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={startNewEvent} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>1</Kbd>
              <span className="tile-icon"><Plus size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">Create new</span>
            </button>
            <button type="button" onClick={() => go('eventList')} disabled={existingOfKind.length === 0} className="tile px-3 py-6 flex flex-col items-center gap-2.5 text-center">
              <Kbd>2</Kbd>
              <span className="tile-icon"><Clock size={22} color={COLORS.accent} /></span>
              <span className="text-sm font-bold">Choose saved</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>{existingOfKind.length > 0 ? `${existingOfKind.length} saved` : 'None saved yet'}</span>
            </button>
          </div>
        )}

        {step === 'eventForm' && (
          <>
            <SectionLabel>What is it?</SectionLabel>
            <input autoFocus value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder={eventKind === 'recurring' ? 'e.g. Check in with Grandma' : 'e.g. Ask Sam about their football game'} className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}` }} />

            {eventKind === 'oneoff' ? (
              <>
                <SectionLabel>When?</SectionLabel>
                <div className="mb-5">
                  <DateDropdown value={eventDate} onChange={setEventDate} minDate={new Date()} />
                </div>
              </>
            ) : (
              <>
                <SectionLabel>Which day(s) of the week?</SectionLabel>
                <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Tap as many as apply, for example Monday through Friday.</p>
                <div className="grid grid-cols-7 gap-1 mb-1.5">
                  {WEEKDAY_SHORT.map((w, i) => {
                    const on = eventWeekdays.includes(i);
                    return <button key={w} type="button" onClick={() => toggleEventWeekday(i)} aria-pressed={on} aria-label={w} className="rounded-xl py-2 flex items-center justify-center" style={{ background: on ? COLORS.accent : COLORS.tile, border: `1.5px solid ${on ? COLORS.accent : COLORS.line}`, color: on ? COLORS.onAccent : COLORS.ink, fontSize: 11, fontWeight: 700 }}>{w[0]}</button>;
                  })}
                </div>
                {eventWeekdays.length > 0 && <p className="text-xs mb-5" style={{ color: COLORS.accent, fontWeight: 600 }}>{formatWeekdays(eventWeekdays)}</p>}
              </>
            )}

            <SectionLabel>What time?</SectionLabel>
            <div className="mb-5">
              <TimeDropdown value={eventTime} onChange={setEventTime} />
            </div>

            <SectionLabel>Usual meaningfulness</SectionLabel>
            <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Pre-fills this each time you log it. You can still change it in the moment.</p>
            <div className="mb-5"><Scale value={eventDefaultMeaningfulness} onChange={setEventDefaultMeaningfulness} label="Usual meaningfulness" /></div>

            <SectionLabel>Who's this about? {optional}</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 8, paddingBottom: 4, maxHeight: 180, overflowY: 'auto' }}>
              {people.map(p => <PersonPick key={p.id} person={p} size={42} active={eventPersonIds.includes(p.id)} onClick={() => toggleEventPerson(p.id)} />)}
            </div>
            {eventGoals.length > 0 && (
              <>
                <div className="mt-5"><SectionLabel>Linked goal {optional}</SectionLabel></div>
                <div className="flex flex-wrap gap-1.5">
                  {eventGoals.map(g => (
                    <button key={g.id} type="button" onClick={() => setEventGoalId(id => id === g.id ? null : g.id)} aria-pressed={eventGoalId === g.id} className={`chip${eventGoalId === g.id ? ' chip--on' : ''}`}>{g.title}{eventPersonIds.length > 1 ? ` (${g.personName})` : ''}</button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {step === 'eventList' && existingOfKind.map(ev => {
          const evPeople = (ev.personIds || []).map(id => people.find(p => p.id === id)).filter(Boolean);
          const isSel = selectedExisting === ev.id;
          const evWeekdays = ev.weekdays || (ev.weekday != null ? [ev.weekday] : []);
          return (
            <div key={ev.id} className="rounded-2xl p-3.5 mb-2.5" style={{ background: COLORS.tile, border: `1.5px solid ${isSel ? COLORS.accent : COLORS.line}`, transition: 'border-color .16s' }}>
              <button type="button" onClick={() => { const next = isSel ? null : ev.id; setSelectedExisting(next); if (next) { setLogMeaningfulness(ev.defaultMeaningfulness || 3); setLogQuickDetailTags([]); setLogTemplatesOpen(false); } }} className="w-full text-left">
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{ev.title}</p>
                <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>
                  {ev.kind === 'recurring' ? formatWeekdays(evWeekdays) : (ev.date ? formatCalendarDate(new Date(`${ev.date}T00:00:00`)) : 'One-off')}
                  {ev.time != null ? ` · ${formatTime12(ev.time)}` : ''}
                  {evPeople.length > 0 ? ` · ${evPeople.map(p => p.name).join(', ')}` : ''}
                </p>
              </button>
              {isSel && (
                <div className="mt-3 fade-anim">
                  {evPeople.length > 0 && (
                    <>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: COLORS.ink }}>How meaningful was it?</p>
                      <div className="mb-3"><Scale size="sm" value={logMeaningfulness} onChange={setLogMeaningfulness} label="How meaningful was it?" /></div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Quick detail {optional}</p>
                        <button type="button" onClick={() => setLogTemplatesOpen(true)} className="text-xs font-semibold" style={{ color: COLORS.accent }}>+ Add detail</button>
                      </div>
                      {logTemplatesOpen && (
                        <TemplatePickerModal title="Add detail" onClose={() => setLogTemplatesOpen(false)} onPick={(item) => setLogQuickDetailTags(prev => [...prev, item])} />
                      )}
                      {logQuickDetailTags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-3">
                          {logQuickDetailTags.map((tag, i) => (
                            <span key={i} className="chip chip--on chip-in" style={{ paddingRight: 6 }}>
                              {tag}
                              <button type="button" onClick={() => setLogQuickDetailTags(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove "${tag}"`} className="p-0.5"><X size={12} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    {evPeople.length > 0 && (
                      <button type="button" onClick={() => { const detail = logQuickDetailTags.join(', '); if (onMarkEventDone) onMarkEventDone(ev.id, occurrenceToLog(ev), { quiet: true }); onSubmit({ personIds: ev.personIds, type: 'other', meaningfulness: logMeaningfulness, notes: [], activeListening: [], summary: detail ? `${ev.title} — ${detail}` : ev.title, pickedDate: new Date(), goalIds: linkedGoalIds ? linkedGoalIds(ev) : undefined }); }} className="flex-1 text-xs font-semibold rounded-full py-2" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Log this now</button>
                    )}
                    <button type="button" onClick={() => openEditEvent(ev)} className="flex-1 text-xs font-semibold rounded-full py-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Edit</button>
                    <button type="button" onClick={() => { onDeleteEvent(ev.id); setSelectedExisting(null); }} className="flex-1 text-xs font-semibold rounded-full py-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.alert}`, color: COLORS.alert }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
