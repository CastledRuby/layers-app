// Journal tab: every logged interaction, newest first, with filters, and a
// pencil on each entry to edit or delete it.

import { useMemo, useState } from 'react';
import { Check, Pencil, Search } from 'lucide-react';
import { CONV_STATES, DIM_LABELS, DIM_ORDER, getLayer, STANDOUTS, TYPE_META } from '../data/constants.js';
import { journalDateLabel, journalDaysAgo, parseISODay } from '../lib/dates.js';
import { summaryFor } from '../lib/text.js';
import { COLORS } from '../theme.js';

// "Past month" is the last 31 days, counted back from today.
const PERIODS = [
  { key: 'all', label: 'Any time', days: null },
  { key: 'week', label: 'Past week', days: 7 },
  { key: 'month', label: 'Past month', days: 31 },
  { key: 'quarter', label: '3 months', days: 92 },
];

function Chip({ active, onClick, children, label, slim }) {
  return (
    <button onClick={onClick} aria-pressed={active} aria-label={label} title={label} className={`text-xs font-medium rounded-full py-1 shrink-0 ${slim ? 'px-2' : 'px-2.5'}`} style={{ background: active ? COLORS.accentSoft : 'transparent', color: active ? COLORS.accent : COLORS.inkSoft }}>
      {children}
    </button>
  );
}

export function JournalView({ today, people, journal, onOpenPerson, onEditEntry }) {
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [period, setPeriod] = useState('all');
  const [query, setQuery] = useState('');
  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);
  const now = useMemo(() => parseISODay(today) || new Date(), [today]);

  const q = query.trim().toLowerCase();
  const days = PERIODS.find(pd => pd.key === period).days;
  const filtered = journal.filter(j => {
    const p = peopleById[j.personId];
    if (!p) return false;
    if (filterPerson !== 'all' && j.personId !== filterPerson) return false;
    if (filterType !== 'all' && j.type !== filterType) return false;
    if (days !== null && journalDaysAgo(j, now) >= days) return false;
    if (q) {
      const haystack = [p.name, summaryFor(j), j.reflection || '', ...(j.added || [])].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const filtering = filterPerson !== 'all' || filterType !== 'all' || period !== 'all' || !!q;
  function clearFilters() { setFilterPerson('all'); setFilterType('all'); setPeriod('all'); setQuery(''); }

  const sorted = [...filtered].sort((a, b) => journalDaysAgo(a, now) - journalDaysAgo(b, now));
  const groups = [];
  sorted.forEach(entry => {
    const label = journalDateLabel(entry, now);
    const last = groups[groups.length - 1];
    if (last && last.date === label) { last.entries.push(entry); } else { groups.push({ date: label, entries: [entry] }); }
  });

  const typeKeys = Object.keys(TYPE_META);

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Journal</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>Every interaction, in one place.</p>

      <div className="flex items-center gap-2 mt-4">
        <Search size={15} color={COLORS.inkSoft} className="shrink-0" />
        <input id="journal-search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the journal..." aria-label="Search the journal" className="flex-1 text-sm rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.line}` }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, maxHeight: 78, overflowY: 'auto' }}>
        <button onClick={() => setFilterPerson('all')} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: filterPerson === 'all' ? COLORS.accent : COLORS.paperRaised, color: filterPerson === 'all' ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${filterPerson === 'all' ? COLORS.accent : COLORS.line}` }}>All people</button>
        {people.map(p => (
          <button key={p.id} onClick={() => setFilterPerson(p.id)} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: filterPerson === p.id ? COLORS.accent : COLORS.paperRaised, color: filterPerson === p.id ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${filterPerson === p.id ? COLORS.accent : COLORS.line}` }}><span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: getLayer(p.layer).color, marginRight: 6, verticalAlign: 1 }} />{p.name}</button>
        ))}
      </div>

      {/* Types and periods each fit on one line down to the window's minimum
          width, with nothing to scroll sideways. Types show just their emoji;
          the name is the button's label and tooltip. */}
      <div className="flex items-center gap-1 mt-2">
        <Chip active={filterType === 'all'} onClick={() => setFilterType('all')} label="All types">All</Chip>
        {typeKeys.map(k => (
          <Chip key={k} slim active={filterType === k} onClick={() => setFilterType(k)} label={TYPE_META[k].label}>{TYPE_META[k].emoji}</Chip>
        ))}
      </div>

      <div className="flex items-center gap-1 mt-1">
        {PERIODS.map(pd => (<Chip key={pd.key} active={period === pd.key} onClick={() => setPeriod(pd.key)}>{pd.label}</Chip>))}
      </div>

      {filtering && (
        <button onClick={clearFilters} className="text-xs font-semibold mt-2" style={{ color: COLORS.accent }}>Clear filters ({filtered.length} of {journal.filter(j => peopleById[j.personId]).length} shown)</button>
      )}

      <div className="mt-5">
        {groups.length === 0 ? (
          <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>{journal.length === 0 ? 'Nothing logged yet. Tap + to log your first interaction.' : 'No interactions match this filter.'}</p>
        ) : groups.map((grp, gi) => (
          <div key={gi} className="mb-5">
            <p className="text-xs font-semibold mb-2" style={{ color: COLORS.inkSoft }}>{grp.date}</p>
            {grp.entries.map(entry => {
              const p = peopleById[entry.personId];
              const l = getLayer(p.layer);
              const meta = TYPE_META[entry.type] || TYPE_META.other;
              const stoodOut = STANDOUTS.filter(s => (entry.standouts || []).includes(s.key)).map(s => s.label);
              const ratings = DIM_ORDER.filter(k => entry.ratings && entry.ratings[k]).map(k => `${DIM_LABELS[k]} ${entry.ratings[k]}`);
              return (
                <div key={entry.id} className="relative mb-2">
                  <button onClick={() => onOpenPerson(p.id)} className="w-full text-left rounded-2xl p-3.5 pr-10" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                    <div className="flex items-center gap-2">
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                      <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.name}</span>
                      <span className="text-xs" style={{ color: COLORS.inkSoft }}>{meta.emoji} {meta.label}</span>
                    </div>
                    <p className="text-sm mt-1.5" style={{ color: COLORS.ink }}>{summaryFor(entry)}</p>
                    {entry.reflection && (<p className="text-xs mt-1.5 italic" style={{ color: COLORS.inkSoft }}>“{entry.reflection}”</p>)}
                    {entry.added && entry.added.length > 0 && (<p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Added: {entry.added.join(', ')}</p>)}
                    {ratings.length > 0 && (<p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Rated: {ratings.join(' · ')}</p>)}
                    {stoodOut.length > 0 && (<p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Stood out: {stoodOut.join(', ')}</p>)}
                    {entry.activeListening && entry.activeListening.length > 0 && (<p className="text-xs mt-1 flex items-center gap-1" style={{ color: l.deep }}><Check size={11} /> Practised active listening</p>)}
                    {entry.analysis && (<p className="text-xs mt-1" style={{ color: l.deep }}>{CONV_STATES[entry.analysis.conversationState] ? `${CONV_STATES[entry.analysis.conversationState].emoji} ${CONV_STATES[entry.analysis.conversationState].label}, ` : ''}grading {entry.analysis.grading.overall}%</p>)}
                  </button>
                  <button onClick={() => onEditEntry(entry.id)} aria-label={`Edit entry: ${p.name}, ${grp.date}`} className="absolute p-1.5" style={{ top: 10, right: 10 }}><Pencil size={14} color={COLORS.inkSoft} /></button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
