// Log an interaction, or create/manage saved events. A step machine; see
// docs/renderer/app-structure.md.

import { useEffect, useState } from 'react';
import { Calendar, Check, Clock, MessageCircle, Plus, Repeat, X } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { Avatar } from '../components/atoms.jsx';
import { DateDropdown, TimeDropdown } from '../components/pickers.jsx';
import { AL_ITEMS, CATEGORIES, categoryMeta, getLayer, NOTE_TEMPLATE_CATEGORY, STANDOUTS, TYPE_META, TYPE_ORDER } from '../data/constants.js';
import { formatCalendarDate, formatTime12, formatWeekdays, nowToMinutes, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
import { occurrenceToLog } from '../lib/reminders.js';
import { TemplatePickerModal } from './TemplatePickerModal.jsx';
import { COLORS } from '../theme.js';

export function LogInteractionModal({ people, defaultPersonId, events, initialStep, initialEditEvent, onClose, onSubmit, onCreateEvent, onUpdateEvent, onDeleteEvent, onMarkEventDone, linkedGoalIds }) {
  const [step, setStep] = useState(initialStep || 'kind'); // kind -> type -> who -> details  |  kind -> eventKind -> eventChoice -> eventForm/eventList
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
  // Optional "More details" (closed by default, so the quick log stays quick).
  const [moreOpen, setMoreOpen] = useState(false);
  const [newInfo, setNewInfo] = useState([]); // [{ category, text }]
  const [newInfoCat, setNewInfoCat] = useState('interests');
  const [newInfoText, setNewInfoText] = useState('');
  const [standouts, setStandouts] = useState([]);
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

  const ML_LABELS = ['Very brief', 'Casual', 'Good conversation', 'Personal', 'Deep conversation'];

  function toggleAL(key) { setAl(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]); }

  // 'D' opens Add Detail directly while on the Details step, without having
  // to click the button — same modal the "+ Add detail" button triggers.
  useEffect(() => {
    if (step !== 'details') return;
    function onKey(e) {
      if (noteTemplatesOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); setNoteTemplatesOpen(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, noteTemplatesOpen]);
  function togglePerson(id) { setPersonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }
  function toggleEventPerson(id) { setEventPersonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }
  function toggleEventWeekday(i) { setEventWeekdays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a, b) => a - b)); }
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
    setStep('eventForm');
  }

  // Lets Home's "Manage recurring" section jump straight into editing a
  // specific event, bypassing kind/eventKind/eventChoice entirely.
  useEffect(() => {
    if (initialEditEvent) openEditEvent(initialEditEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSave = personIds.length > 0 && type;
  // Topics picked with "+ Add detail" are also saved on the person's profile
  // (NOTE_TEMPLATE_CATEGORY says where) when the log is with one person; a
  // group log keeps them in its note only. They used to reach only the note.
  const profileNotes = personIds.length === 1
    ? quickNoteTags.filter(t => NOTE_TEMPLATE_CATEGORY[t.cat]).map(t => ({ category: NOTE_TEMPLATE_CATEGORY[t.cat], text: t.text, emoji: t.emoji }))
    : [];
  const loggedPerson = personIds.length === 1 ? people.find(p => p.id === personIds[0]) : null;
  // Every active goal of the people in this log moves unless you untick it.
  const goalsInLog = people.filter(p => personIds.includes(p.id)).flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ id: g.id, title: g.title, personName: p.name })));
  function addNewInfo() {
    const text = newInfoText.trim();
    if (!text) return;
    setNewInfo(prev => [...prev, { category: newInfoCat, text }]);
    setNewInfoText('');
  }
  function toggleIn(setter, key) { setter(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]); }
  function handleSave() {
    if (!canSave) return;
    const combined = [...quickNoteTags.map(t => t.text), quickNote.trim()].filter(Boolean).join(', ');
    const notes = [...profileNotes, ...(loggedPerson ? newInfo.map(n => ({ ...n, emoji: categoryMeta(n.category).emoji })) : [])];
    onSubmit({
      personIds, type, meaningfulness, notes, activeListening: al, summary: combined || undefined, pickedDate: logDate,
      standouts,
      goalIds: untickedGoals.length > 0 ? goalsInLog.map(g => g.id).filter(id => !untickedGoals.includes(id)) : undefined,
      reflection: reflection.trim() || undefined,
    });
  }

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

  const titles = {
    kind: 'What are you logging?',
    type: 'What did you do?',
    who: 'Who was this with?',
    details: 'Add details',
    eventKind: 'Recurring or one-off?',
    eventChoice: 'Create new or choose existing?',
    eventForm: editingEventId ? 'Edit event' : (eventKind === 'recurring' ? 'New recurring event' : 'New one-off event'),
    eventList: 'Your saved events',
  };
  const footer =
    step === 'who' ? (
      <button onClick={() => personIds.length > 0 && setStep('details')} disabled={personIds.length === 0} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: personIds.length > 0 ? COLORS.accent : COLORS.line, color: personIds.length > 0 ? '#fff' : COLORS.inkSoft }}>
        Confirm{personIds.length > 0 ? ` (${personIds.length} selected)` : ''}
      </button>
    ) : step === 'details' ? (
      <button onClick={handleSave} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>Save interaction</button>
    ) : step === 'eventForm' ? (
      <button onClick={handleSaveEvent} disabled={!canSaveEvent} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSaveEvent ? COLORS.accent : COLORS.line, color: canSaveEvent ? '#fff' : COLORS.inkSoft }}>{editingEventId ? 'Save changes' : `Save ${eventKind === 'recurring' ? 'recurring event' : 'event'}`}</button>
    ) : null;

  return (
    <Sheet title={titles[step]} onClose={onClose} footer={footer} tall>
      {step === 'kind' && (
        <div className="grid grid-cols-2 gap-3">
          {/* With nobody in your circle yet, only events can be made. */}
          <button onClick={() => people.length > 0 && setStep('type')} disabled={people.length === 0} className="rounded-2xl py-6 flex flex-col items-center gap-2" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}`, opacity: people.length === 0 ? 0.55 : 1 }}>
            <MessageCircle size={26} color={COLORS.accent} />
            <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Interaction</span>
            <span className="text-xs text-center" style={{ color: COLORS.inkSoft }}>{people.length === 0 ? 'Add someone in People first' : 'Something that already happened'}</span>
          </button>
          <button onClick={() => setStep('eventKind')} className="rounded-2xl py-6 flex flex-col items-center gap-2" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}` }}>
            <Calendar size={26} color={COLORS.accent} />
            <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Event</span>
            <span className="text-xs text-center" style={{ color: COLORS.inkSoft }}>Something upcoming or recurring</span>
          </button>
        </div>
      )}

      {step === 'type' && (
        <>
          <button onClick={() => setStep('kind')} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_ORDER.map(key => {
              const meta = TYPE_META[key];
              return (
                <button key={key} onClick={() => { setType(key); setStep('who'); }} className="rounded-2xl py-4 flex flex-col items-center gap-1.5" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}` }}>
                  <span style={{ fontSize: 24 }}>{meta.emoji}</span>
                  <span className="text-xs" style={{ color: COLORS.ink, fontWeight: 500 }}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 'who' && (
        <>
          <button onClick={() => setStep('type')} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>
          <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Tap everyone who was involved — you can pick more than one.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, rowGap: 12, paddingBottom: 4, maxHeight: 320, overflowY: 'auto' }}>
            {people.map(p => {
              const active = personIds.includes(p.id); const l = getLayer(p.layer);
              return (
                <button key={p.id} onClick={() => togglePerson(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    <Avatar emoji={p.emoji} size={44} ringColor={active ? COLORS.accent : l.color} />
                    {active && (
                      <span style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${COLORS.paper}` }}>
                        <Check size={9} color="#fff" />
                      </span>
                    )}
                  </span>
                  <span className="text-xs truncate" style={{ maxWidth: 56, color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 'details' && (
        <>
          <button onClick={() => setStep('who')} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>

          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>When was this?</p>
          <div className="mb-5" style={{ position: 'relative', zIndex: 20 }}>
            <DateDropdown value={logDate} onChange={setLogDate} maxDate={new Date()} />
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Quick note <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span></p>
            <button type="button" onClick={() => setNoteTemplatesOpen(true)} className="text-xs font-semibold" style={{ color: COLORS.accent }}>+ Add detail <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>(D)</span></button>
          </div>
          {noteTemplatesOpen && (
            <TemplatePickerModal title="Add detail" onClose={() => setNoteTemplatesOpen(false)} onPick={(text, emoji, cat) => setQuickNoteTags(prev => [...prev, { text, emoji, cat }])} />
          )}
          {quickNoteTags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {quickNoteTags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                  {tag.text}
                  <button onClick={() => setQuickNoteTags(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove "${tag.text}"`} className="p-0.5"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
          {profileNotes.length > 0 && loggedPerson && (
            <p className="text-xs mb-2.5" style={{ color: COLORS.inkSoft }}>Topics are also saved to {loggedPerson.name}'s profile.</p>
          )}
          <input value={quickNote} onChange={e => setQuickNote(e.target.value)} placeholder="e.g. Caught up after school, good chat" className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}` }} />

          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>How meaningful was it?</p>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {[1, 2, 3, 4, 5].map(n => {
              const active = meaningfulness === n;
              return (<button key={n} onClick={() => setMeaningfulness(n)} style={{ width: 38, height: 38, borderRadius: '50%', background: active ? COLORS.accent : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}`, color: active ? '#fff' : COLORS.ink, fontWeight: 700, fontSize: 14 }}>{n}</button>);
            })}
          </div>
          <p className="text-xs mb-5" style={{ color: COLORS.inkSoft }}>{ML_LABELS[meaningfulness - 1]}</p>

          <p className="text-sm font-semibold mb-2 mt-1" style={{ color: COLORS.ink }}>Did you practise active listening?</p>
          <div>
            {AL_ITEMS.map(item => {
              const checked = al.includes(item.key);
              return (
                <button key={item.key} type="button" onClick={() => toggleAL(item.key)} className="w-full flex items-center gap-3 py-2 text-left">
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${checked ? COLORS.accent : COLORS.line}`, background: checked ? COLORS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {checked && <Check size={13} color="#fff" />}
                  </span>
                  <span className="text-sm" style={{ color: COLORS.ink }}>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* P1: the optional, progressive part of logging. */}
          <button type="button" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} className="w-full flex items-center justify-between rounded-2xl px-4 py-3 mt-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>More details <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span></span>
            <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>{moreOpen ? 'Hide' : 'Add'}</span>
          </button>
          {moreOpen && (
            <div className="mt-4">
              {loggedPerson && (
                <div className="mb-5">
                  <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Something new about {loggedPerson.name}?</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {CATEGORIES.map(c => (
                      <button key={c.key} type="button" onClick={() => setNewInfoCat(c.key)} aria-pressed={newInfoCat === c.key} className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: newInfoCat === c.key ? COLORS.accent : COLORS.paperRaised, color: newInfoCat === c.key ? '#fff' : COLORS.inkSoft, border: `1px solid ${newInfoCat === c.key ? COLORS.accent : COLORS.line}` }}>{c.emoji} {c.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input value={newInfoText} onChange={e => setNewInfoText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewInfo(); } }} placeholder={categoryMeta(newInfoCat).placeholder} aria-label="Something new" className="flex-1 text-sm rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.line}` }} />
                    <button type="button" onClick={addNewInfo} disabled={!newInfoText.trim()} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: newInfoText.trim() ? COLORS.accent : COLORS.line, color: newInfoText.trim() ? '#fff' : COLORS.inkSoft }}>Add</button>
                  </div>
                  {newInfo.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {newInfo.map((n, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                          {categoryMeta(n.category).emoji} {n.text}
                          <button type="button" onClick={() => setNewInfo(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove "${n.text}"`} className="p-0.5"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What stood out?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} className="mb-5">
                {STANDOUTS.map(s => (
                  <button key={s.key} type="button" onClick={() => toggleIn(setStandouts, s.key)} aria-pressed={standouts.includes(s.key)} className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: standouts.includes(s.key) ? COLORS.accent : COLORS.paperRaised, color: standouts.includes(s.key) ? '#fff' : COLORS.inkSoft, border: `1px solid ${standouts.includes(s.key) ? COLORS.accent : COLORS.line}` }}>{s.label}</button>
                ))}
              </div>

              {goalsInLog.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>Goals this moved</p>
                  <p className="text-xs mb-1.5" style={{ color: COLORS.inkSoft }}>Untick any it didn't help. Unticked goals stay where they are.</p>
                  {goalsInLog.map(g => {
                    const checked = !untickedGoals.includes(g.id);
                    return (
                      <button key={g.id} type="button" role="checkbox" aria-checked={checked} onClick={() => toggleIn(setUntickedGoals, g.id)} className="w-full flex items-center gap-3 py-1.5 text-left">
                        <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? COLORS.accent : COLORS.line}`, background: checked ? COLORS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {checked && <Check size={12} color="#fff" />}
                        </span>
                        <span className="text-sm" style={{ color: COLORS.ink }}>{g.title}{personIds.length > 1 ? ` (${g.personName})` : ''}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>How did it feel?</p>
              <textarea value={reflection} onChange={e => setReflection(e.target.value)} rows={3} aria-label="Reflection" placeholder="What went well, or what you'd try next time" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />
            </div>
          )}
        </>
      )}

      {step === 'eventKind' && (
        <>
          <button onClick={() => setStep('kind')} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setEventKind('oneoff'); setStep('eventChoice'); }} className="rounded-2xl py-6 flex flex-col items-center gap-2" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}` }}>
              <Calendar size={24} color={COLORS.accent} />
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>One-off</span>
              <span className="text-xs text-center" style={{ color: COLORS.inkSoft }}>A single upcoming thing</span>
            </button>
            <button onClick={() => { setEventKind('recurring'); setStep('eventChoice'); }} className="rounded-2xl py-6 flex flex-col items-center gap-2" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}` }}>
              <Repeat size={24} color={COLORS.accent} />
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Recurring</span>
              <span className="text-xs text-center" style={{ color: COLORS.inkSoft }}>Repeats weekly</span>
            </button>
          </div>
        </>
      )}

      {step === 'eventChoice' && (
        <>
          <button onClick={() => setStep('eventKind')} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setEditingEventId(null); setEventTitle(''); setEventPersonIds(defaultPersonId ? [defaultPersonId] : []); setEventDate(new Date()); setEventWeekdays([new Date().getDay()]); setEventTime(nowToMinutes()); setEventDefaultMeaningfulness(3); setEventGoalId(null); setStep('eventForm'); }} className="rounded-2xl py-6 flex flex-col items-center gap-2" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}` }}>
              <Plus size={24} color={COLORS.accent} />
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Create new</span>
            </button>
            <button onClick={() => existingOfKind.length > 0 && setStep('eventList')} disabled={existingOfKind.length === 0} className="rounded-2xl py-6 flex flex-col items-center gap-2" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}`, opacity: existingOfKind.length === 0 ? 0.5 : 1 }}>
              <Clock size={24} color={COLORS.accent} />
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Choose saved</span>
              <span className="text-xs text-center" style={{ color: COLORS.inkSoft }}>{existingOfKind.length > 0 ? `${existingOfKind.length} saved` : 'None saved yet'}</span>
            </button>
          </div>
        </>
      )}

      {step === 'eventForm' && (
        <>
          <button onClick={() => setStep(editingEventId ? 'eventList' : 'eventChoice')} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>

          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What is it?</p>
          <input autoFocus value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder={eventKind === 'recurring' ? 'e.g. Check in with Grandma' : 'e.g. Ask Sam about their football game'} className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}` }} />

          {eventKind === 'oneoff' ? (
            <>
              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>When?</p>
              <div className="mb-5" style={{ position: 'relative', zIndex: 21 }}>
                <DateDropdown value={eventDate} onChange={setEventDate} minDate={new Date()} />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Which day(s) of the week?</p>
              <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Tap as many as apply — e.g. Monday through Friday.</p>
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {WEEKDAY_SHORT.map((w, i) => (
                  <button key={w} type="button" onClick={() => toggleEventWeekday(i)} className="rounded-xl py-2 flex items-center justify-center" style={{ background: eventWeekdays.includes(i) ? COLORS.accent : COLORS.paperRaised, border: `1.5px solid ${eventWeekdays.includes(i) ? COLORS.accent : COLORS.line}`, color: eventWeekdays.includes(i) ? '#fff' : COLORS.ink, fontSize: 11, fontWeight: 600 }}>{w[0]}</button>
                ))}
              </div>
              {eventWeekdays.length > 0 && <p className="text-xs mb-5" style={{ color: COLORS.accent, fontWeight: 600 }}>{formatWeekdays(eventWeekdays)}</p>}
            </>
          )}

          <p className="text-sm font-semibold mb-2 mt-1" style={{ color: COLORS.ink }}>What time?</p>
          <div className="mb-5" style={{ position: 'relative', zIndex: 20 }}>
            <TimeDropdown value={eventTime} onChange={setEventTime} />
          </div>

          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Usual meaningfulness</p>
          <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Pre-fills this each time you log it — you can still change it in the moment.</p>
          <div className="flex items-center justify-between gap-2 mb-5">
            {[1, 2, 3, 4, 5].map(n => {
              const active = eventDefaultMeaningfulness === n;
              return (<button key={n} type="button" onClick={() => setEventDefaultMeaningfulness(n)} style={{ width: 36, height: 36, borderRadius: '50%', background: active ? COLORS.accent : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}`, color: active ? '#fff' : COLORS.ink, fontWeight: 700, fontSize: 13 }}>{n}</button>);
            })}
          </div>

          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Who's this about? <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, rowGap: 12, paddingBottom: 4, maxHeight: 168, overflowY: 'auto' }}>
            {people.map(p => {
              const active = eventPersonIds.includes(p.id); const l = getLayer(p.layer);
              return (
                <button key={p.id} onClick={() => toggleEventPerson(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    <Avatar emoji={p.emoji} size={40} ringColor={active ? COLORS.accent : l.color} />
                    {active && (
                      <span style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${COLORS.paper}` }}>
                        <Check size={9} color="#fff" />
                      </span>
                    )}
                  </span>
                  <span className="text-xs truncate" style={{ maxWidth: 56, color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
                </button>
              );
            })}
          </div>
          {eventGoals.length > 0 && (
            <>
              <p className="text-sm font-semibold mb-2 mt-5" style={{ color: COLORS.ink }}>Linked goal <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span></p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {eventGoals.map(g => (
                  <button key={g.id} type="button" onClick={() => setEventGoalId(id => id === g.id ? null : g.id)} aria-pressed={eventGoalId === g.id} className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: eventGoalId === g.id ? COLORS.accent : COLORS.paperRaised, color: eventGoalId === g.id ? '#fff' : COLORS.inkSoft, border: `1px solid ${eventGoalId === g.id ? COLORS.accent : COLORS.line}` }}>{g.title}{eventPersonIds.length > 1 ? ` (${g.personName})` : ''}</button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {step === 'eventList' && (
        <>
          <button onClick={() => { setStep('eventChoice'); setSelectedExisting(null); }} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>
          {existingOfKind.map(ev => {
            const evPeople = (ev.personIds || []).map(id => people.find(p => p.id === id)).filter(Boolean);
            const isSel = selectedExisting === ev.id;
            const evWeekdays = ev.weekdays || (ev.weekday != null ? [ev.weekday] : []);
            return (
              <div key={ev.id} className="rounded-2xl p-3.5 mb-2.5" style={{ background: COLORS.paperRaised, border: `1.5px solid ${isSel ? COLORS.accent : COLORS.line}` }}>
                <button onClick={() => { const next = isSel ? null : ev.id; setSelectedExisting(next); if (next) { setLogMeaningfulness(ev.defaultMeaningfulness || 3); setLogQuickDetailTags([]); setLogTemplatesOpen(false); } }} className="w-full text-left">
                  <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{ev.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>
                    {ev.kind === 'recurring' ? formatWeekdays(evWeekdays) : (ev.date ? formatCalendarDate(new Date(`${ev.date}T00:00:00`)) : 'One-off')}
                    {ev.time != null ? ` · ${formatTime12(ev.time)}` : ''}
                    {evPeople.length > 0 ? ` · ${evPeople.map(p => p.name).join(', ')}` : ''}
                  </p>
                </button>
                {isSel && (
                  <div className="mt-3">
                    {evPeople.length > 0 && (
                      <>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: COLORS.ink }}>How meaningful was it?</p>
                        <div className="flex items-center justify-between gap-1.5 mb-3">
                          {[1, 2, 3, 4, 5].map(n => {
                            const active = logMeaningfulness === n;
                            return (<button key={n} type="button" onClick={() => setLogMeaningfulness(n)} style={{ width: 32, height: 32, borderRadius: '50%', background: active ? COLORS.accent : COLORS.paper, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}`, color: active ? '#fff' : COLORS.ink, fontWeight: 700, fontSize: 12 }}>{n}</button>);
                          })}
                        </div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Quick detail <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span></p>
                          <button type="button" onClick={() => setLogTemplatesOpen(true)} className="text-xs font-semibold" style={{ color: COLORS.accent }}>+ Add detail</button>
                        </div>
                        {logTemplatesOpen && (
                          <TemplatePickerModal title="Add detail" onClose={() => setLogTemplatesOpen(false)} onPick={(item) => setLogQuickDetailTags(prev => [...prev, item])} />
                        )}
                        {logQuickDetailTags.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            {logQuickDetailTags.map((tag, i) => (
                              <span key={i} className="flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                                {tag}
                                <button onClick={() => setLogQuickDetailTags(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove "${tag}"`} className="p-0.5"><X size={11} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      {evPeople.length > 0 && (
                        <button onClick={() => { const detail = logQuickDetailTags.join(', '); if (onMarkEventDone) onMarkEventDone(ev.id, occurrenceToLog(ev), { quiet: true }); onSubmit({ personIds: ev.personIds, type: 'other', meaningfulness: logMeaningfulness, notes: [], activeListening: [], summary: detail ? `${ev.title} — ${detail}` : ev.title, pickedDate: new Date(), goalIds: linkedGoalIds ? linkedGoalIds(ev) : undefined }); }} className="flex-1 text-xs font-semibold rounded-full py-2" style={{ background: COLORS.accent, color: '#fff' }}>Log this now</button>
                      )}
                      <button onClick={() => openEditEvent(ev)} className="flex-1 text-xs font-semibold rounded-full py-2" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Edit</button>
                      <button onClick={() => { onDeleteEvent(ev.id); setSelectedExisting(null); }} className="flex-1 text-xs font-semibold rounded-full py-2" style={{ background: COLORS.paper, border: `1px solid ${COLORS.alert}`, color: COLORS.alert }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
