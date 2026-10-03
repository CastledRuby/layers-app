// Home tab.

import { useMemo, useState } from 'react';
import { Repeat, X } from 'lucide-react';
import { Avatar, ProgressBar } from '../components/atoms.jsx';
import { FOCUS_LABELS, getLayer } from '../data/constants.js';
import { formatCalendarDate, formatTime12, formatWeekdays, isJournalThisWeek, journalDateLabel, journalDaysAgo, newestFirst, parseISODay, startOfDay } from '../lib/dates.js';
import { homeGoalTitle, summaryFor } from '../lib/text.js';
import { TemplatePickerModal } from '../modals/TemplatePickerModal.jsx';
import { COLORS } from '../theme.js';

export function HomeView({ today, people, journal, generalGoals, events, profile, onOpenPerson, onSwitchTab, onOpenGoals, onOpenCoach, onLogEvent, onManageEvents, onEditEvent, onDeleteEvent }) {
  // `today` (from useToday) changes at midnight. The date maths below runs
  // from it, so "Upcoming", "haven't caught up" and the weekly counts
  // refresh then, even if the app has been open in the tray for days.
  const now = useMemo(() => parseISODay(today) || new Date(), [today]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);
  const [expandedUpcoming, setExpandedUpcoming] = useState(null);
  const [upcomingMeaningfulness, setUpcomingMeaningfulness] = useState(3);
  const [upcomingQuickDetailTags, setUpcomingQuickDetailTags] = useState([]);
  const [upcomingTemplatesOpen, setUpcomingTemplatesOpen] = useState(false);
  const [manageEventsOpen, setManageEventsOpen] = useState(false);

  // "Upcoming" lists what's due in the next week, worked out from `today`.
  // These are in-app reminders: the only desktop notification Layers sends is
  // the daily check-in nudge (lib/hooks.js).
  const upcoming = useMemo(() => {
    const day = startOfDay(now);
    const items = [];
    (events || []).forEach(ev => {
      const evWeekdays = ev.weekdays || (ev.weekday != null ? [ev.weekday] : []);
      if (ev.kind === 'oneoff' && ev.date) {
        const d = new Date(ev.date + 'T00:00:00');
        const diff = Math.round((d - day) / 86400000);
        if (diff >= 0 && diff <= 7) items.push({ ...ev, sortAt: d.getTime() + (ev.time || 0) * 60000, when: diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : formatCalendarDate(d) });
      } else if (ev.kind === 'recurring' && evWeekdays.includes(day.getDay())) {
        items.push({ ...ev, sortAt: day.getTime() + (ev.time || 0) * 60000, when: 'Today' });
      }
    });
    return items.sort((a, b) => a.sortAt - b.sortAt).slice(0, 4);
  }, [events, now]);

  const activeGoals = useMemo(() => people.flatMap(p => p.goals).concat(generalGoals).filter(g => g.progress < 100).length, [people, generalGoals]);

  // People you haven't logged anything with in a while — reuses journal
  // data that already exists, just resurfaced as a nudge rather than
  // something you'd have to notice yourself by scrolling each profile.
  const quietPeople = useMemo(() => {
    const lastByPerson = new Map();
    journal.forEach(j => {
      const days = journalDaysAgo(j, now);
      const cur = lastByPerson.get(j.personId);
      if (cur === undefined || days < cur) lastByPerson.set(j.personId, days);
    });
    return people
      .map(p => ({ person: p, daysQuiet: lastByPerson.has(p.id) ? lastByPerson.get(p.id) : null }))
      .filter(x => x.daysQuiet === null || x.daysQuiet >= 14)
      .sort((a, b) => (b.daysQuiet === null ? 9999 : b.daysQuiet) - (a.daysQuiet === null ? 9999 : a.daysQuiet))
      .slice(0, 4);
  }, [people, journal, now]);
  const conversationsLogged = journal.length;
  const meaningfulInteractions = useMemo(() => journal.filter(j => j.meaningfulness >= 4).length, [journal]);
  const relationshipsInProgress = useMemo(() => {
    const s = new Set();
    people.forEach(p => { if (p.goals.some(g => g.progress < 100)) s.add(p.id); });
    journal.forEach(j => { if (isJournalThisWeek(j, now)) s.add(j.personId); });
    return s.size;
  }, [people, journal, now]);

  const topGoals = useMemo(() => {
    const fromPeople = people.flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ ...g, personName: p.name, color: getLayer(p.layer).color })));
    const fromGeneral = generalGoals.filter(g => g.progress < 100).map(g => ({ ...g, personName: null, color: COLORS.accent }));
    return [...fromPeople, ...fromGeneral].sort((a, b) => b.progress - a.progress).slice(0, 4);
  }, [people, generalGoals]);

  const recent = useMemo(() => newestFirst(journal, now).filter(j => peopleById[j.personId]).slice(0, 3), [journal, now, peopleById]);

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{greeting}{profile && profile.name ? `, ${profile.name}` : ''} 👋</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{profile && profile.focus && FOCUS_LABELS[profile.focus] ? `Focusing on ${FOCUS_LABELS[profile.focus]}.` : 'Your social progress, at a glance.'}</p>

      <div className="grid grid-cols-2 gap-y-4 mt-6">
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{activeGoals}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>active goals</p>
        </div>
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{conversationsLogged}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>conversations logged</p>
        </div>
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{meaningfulInteractions}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>meaningful interactions</p>
        </div>
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{relationshipsInProgress}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>being developed</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-7">
        <button onClick={() => onOpenCoach('prepare')} className="rounded-2xl p-3.5 text-left" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <p className="text-sm font-semibold mt-1.5" style={{ color: COLORS.ink }}>Prepare to talk</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Coach tips before a chat</p>
        </button>
        <button onClick={() => onOpenCoach('analyse')} className="rounded-2xl p-3.5 text-left" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <span style={{ fontSize: 20 }}>📸</span>
          <p className="text-sm font-semibold mt-1.5" style={{ color: COLORS.ink }}>Analyse a conversation</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Review a sample chat</p>
        </button>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between">
          <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>Current goals</p>
          <button onClick={onOpenGoals} className="text-xs font-medium" style={{ color: COLORS.accent }}>See all</button>
        </div>
        <div className="mt-3">
          {topGoals.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>No active goals yet. Set one to start tracking progress.</p>
          ) : topGoals.map(g => (
            <button key={g.id} onClick={() => g.personId ? onOpenPerson(g.personId) : onOpenGoals()} className="w-full text-left rounded-2xl p-3.5 mb-2.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{homeGoalTitle(g, g.personName)}</p>
                <span className="font-display shrink-0" style={{ fontSize: 19, color: g.color }}>{g.progress}%</span>
              </div>
              <div className="mt-2"><ProgressBar percent={g.progress} color={g.color} height={7} /></div>
              <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{g.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Always shown, so "+ New" is there before the first reminder exists. */}
      <div className="mt-7">
          <div className="flex items-center justify-between">
            <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>Upcoming</p>
            <div className="flex items-center gap-3">
              {events && events.length > 0 && (
                <button onClick={() => setManageEventsOpen(o => !o)} className="text-xs font-medium" style={{ color: COLORS.accent }}>{manageEventsOpen ? 'Hide manage' : 'Manage'}</button>
              )}
              <button onClick={onManageEvents} className="text-xs font-medium" style={{ color: COLORS.accent }}>+ New</button>
            </div>
          </div>
          <p className="text-xs mt-0.5 mb-2.5" style={{ color: COLORS.inkSoft }}>{upcoming.length > 0 ? 'Reminders for the next 7 days.' : 'Nothing in the next 7 days. Use + New for a one-off or weekly reminder.'}</p>

          {manageEventsOpen && (
            <div className="rounded-2xl p-3.5 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              <p className="text-xs font-semibold mb-2.5" style={{ color: COLORS.inkSoft }}>All saved events ({events.length})</p>
              {events.length === 0 ? (
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>No events saved yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {events.map(ev => {
                    const evPeople = (ev.personIds || []).map(id => peopleById[id]).filter(Boolean);
                    const evWeekdays = ev.weekdays || (ev.weekday != null ? [ev.weekday] : []);
                    return (
                      <div key={ev.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: COLORS.paper }}>
                        <div style={{ minWidth: 0 }}>
                          <p className="text-xs font-semibold truncate" style={{ color: COLORS.ink }}>{ev.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>
                            {ev.kind === 'recurring' ? formatWeekdays(evWeekdays) : ev.date ? `${formatCalendarDate(new Date(`${ev.date}T00:00:00`))}${ev.date < today ? ' (passed)' : ''}` : 'One-off'}
                            {ev.time != null ? ` · ${formatTime12(ev.time)}` : ''}
                            {evPeople.length > 0 ? ` · ${evPeople.map(p => p.name).join(', ')}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => onEditEvent(ev)} className="text-xs font-semibold rounded-full px-2.5 py-1.5" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Edit</button>
                          <button onClick={() => onDeleteEvent(ev.id)} className="text-xs font-semibold rounded-full px-2.5 py-1.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.alert}`, color: COLORS.alert }}>Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {upcoming.length > 0 && (
          <div className="flex flex-col gap-2">
            {upcoming.map(ev => {
              const evPeople = (ev.personIds || []).map(id => peopleById[id]).filter(Boolean);
              const isOpen = expandedUpcoming === ev.id;
              return (
                <div key={ev.id} className="rounded-2xl p-3.5" style={{ background: COLORS.paperRaised, border: `1px solid ${isOpen ? COLORS.accent : COLORS.line}` }}>
                  <button className="w-full text-left" onClick={() => { const next = isOpen ? null : ev.id; setExpandedUpcoming(next); if (next) { setUpcomingMeaningfulness(ev.defaultMeaningfulness || 3); setUpcomingQuickDetailTags([]); setUpcomingTemplatesOpen(false); } }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{ev.title}</p>
                      {ev.kind === 'recurring' && <Repeat size={13} color={COLORS.inkSoft} />}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>
                      {ev.when}{ev.time != null ? ` · ${formatTime12(ev.time)}` : ''}
                      {evPeople.length > 0 ? ` · ${evPeople.map(p => p.name).join(', ')}` : ''}
                    </p>
                  </button>
                  {isOpen && evPeople.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold mb-1.5" style={{ color: COLORS.ink }}>How meaningful was it?</p>
                      <div className="flex items-center justify-between gap-1.5 mb-3">
                        {[1, 2, 3, 4, 5].map(n => {
                          const active = upcomingMeaningfulness === n;
                          return (<button key={n} type="button" onClick={() => setUpcomingMeaningfulness(n)} style={{ width: 30, height: 30, borderRadius: '50%', background: active ? COLORS.accent : COLORS.paper, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}`, color: active ? '#fff' : COLORS.ink, fontWeight: 700, fontSize: 12 }}>{n}</button>);
                        })}
                      </div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Quick detail <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span></p>
                        <button type="button" onClick={() => setUpcomingTemplatesOpen(true)} className="text-xs font-semibold" style={{ color: COLORS.accent }}>+ Add detail</button>
                      </div>
                      {upcomingTemplatesOpen && (
                        <TemplatePickerModal title="Add detail" onClose={() => setUpcomingTemplatesOpen(false)} onPick={(item) => setUpcomingQuickDetailTags(prev => [...prev, item])} />
                      )}
                      {upcomingQuickDetailTags.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                          {upcomingQuickDetailTags.map((tag, i) => (
                            <span key={i} className="flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                              {tag}
                              <button onClick={() => setUpcomingQuickDetailTags(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove "${tag}"`} className="p-0.5"><X size={11} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <button onClick={() => { onLogEvent(ev, upcomingMeaningfulness, upcomingQuickDetailTags.join(', ')); setExpandedUpcoming(null); }} className="w-full text-xs font-semibold rounded-full py-2" style={{ background: COLORS.accent, color: '#fff' }}>Log this now</button>
                    </div>
                  )}
                  {isOpen && evPeople.length === 0 && (
                    <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Nobody is linked to this reminder, so there's nothing to log. Use Manage, then Edit, to add someone.</p>
                  )}
                </div>
              );
            })}
          </div>
          )}
      </div>

      {quietPeople.length > 0 && (
        <div className="mt-7">
          <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>Haven't caught up in a while</p>
          <p className="text-xs mt-0.5 mb-2.5" style={{ color: COLORS.inkSoft }}>Based on your logged interactions.</p>
          <div className="flex flex-col gap-2">
            {quietPeople.map(({ person, daysQuiet }) => {
              const l = getLayer(person.layer);
              return (
                <button key={person.id} onClick={() => onOpenPerson(person.id)} className="w-full flex items-center gap-3 rounded-2xl p-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, textAlign: 'left' }}>
                  <Avatar emoji={person.emoji} size={38} ringColor={l.color} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="text-sm font-semibold truncate" style={{ color: COLORS.ink }}>{person.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{daysQuiet === null ? 'No interactions logged yet' : daysQuiet >= 30 ? `${Math.round(daysQuiet / 30)} month${Math.round(daysQuiet / 30) > 1 ? 's' : ''} since your last log` : `${daysQuiet} days since your last log`}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-7">
          <div className="flex items-center justify-between">
            <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>Recent activity</p>
            <button onClick={() => onSwitchTab('journal')} className="text-xs font-medium" style={{ color: COLORS.accent }}>View all</button>
          </div>
          <div className="mt-3">
            {recent.map(entry => {
              const p = peopleById[entry.personId];
              if (!p) return null;
              const l = getLayer(p.layer);
              return (
                <button key={entry.id} onClick={() => onOpenPerson(p.id)} className="w-full flex items-center gap-3 py-2.5 text-left" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: COLORS.ink }}><span className="font-semibold">{p.name}:</span> {summaryFor(entry)}</p>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: COLORS.inkSoft }}>{journalDateLabel(entry)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
