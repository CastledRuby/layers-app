// Journal tab.

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { CONV_STATES, getLayer, TYPE_META } from '../data/constants.js';
import { journalDateLabel, journalDaysAgo } from '../lib/dates.js';
import { summaryFor } from '../lib/text.js';
import { COLORS } from '../theme.js';

export function JournalView({ people, journal, onOpenPerson }) {
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [query, setQuery] = useState('');
  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);

  const q = query.trim().toLowerCase();
  const filtered = journal.filter(j => {
    if (filterPerson !== 'all' && j.personId !== filterPerson) return false;
    if (filterType !== 'all' && j.type !== filterType) return false;
    if (q) {
      const p = peopleById[j.personId];
      const haystack = [p ? p.name : '', summaryFor(j), ...(j.added || [])].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const now = new Date();
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
        <input id="journal-search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the journal..." className="flex-1 text-sm rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.line}` }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, maxHeight: 78, overflowY: 'auto' }}>
        <button onClick={() => setFilterPerson('all')} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: filterPerson === 'all' ? COLORS.accent : COLORS.paperRaised, color: filterPerson === 'all' ? '#fff' : COLORS.inkSoft, border: `1px solid ${filterPerson === 'all' ? COLORS.accent : COLORS.line}` }}>All people</button>
        {people.map(p => (
          <button key={p.id} onClick={() => setFilterPerson(p.id)} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: filterPerson === p.id ? COLORS.accent : COLORS.paperRaised, color: filterPerson === p.id ? '#fff' : COLORS.inkSoft, border: `1px solid ${filterPerson === p.id ? COLORS.accent : COLORS.line}` }}>{p.name}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => setFilterType('all')} className="text-xs font-medium rounded-full px-2.5 py-1 shrink-0" style={{ background: filterType === 'all' ? COLORS.accentSoft : 'transparent', color: filterType === 'all' ? COLORS.accent : COLORS.inkSoft }}>All types</button>
        {typeKeys.map(k => (
          <button key={k} onClick={() => setFilterType(k)} className="text-xs font-medium rounded-full px-2.5 py-1 shrink-0" style={{ background: filterType === k ? COLORS.accentSoft : 'transparent', color: filterType === k ? COLORS.accent : COLORS.inkSoft }}>{TYPE_META[k].emoji} {TYPE_META[k].label}</button>
        ))}
      </div>

      <div className="mt-5">
        {groups.length === 0 ? (
          <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>{journal.length === 0 ? 'Nothing logged yet. Tap + to log your first interaction.' : 'No interactions match this filter.'}</p>
        ) : groups.map((grp, gi) => (
          <div key={gi} className="mb-5">
            <p className="text-xs font-semibold mb-2" style={{ color: COLORS.inkSoft }}>{grp.date}</p>
            {grp.entries.map(entry => {
              const p = peopleById[entry.personId];
              if (!p) return null;
              const l = getLayer(p.layer);
              const meta = TYPE_META[entry.type] || TYPE_META.other;
              return (
                <button key={entry.id} onClick={() => onOpenPerson(p.id)} className="w-full text-left rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <div className="flex items-center gap-2">
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                    <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.name}</span>
                    <span className="text-xs" style={{ color: COLORS.inkSoft }}>{meta.emoji} {meta.label}</span>
                  </div>
                  <p className="text-sm mt-1.5" style={{ color: COLORS.ink }}>{summaryFor(entry)}</p>
                  {entry.added && entry.added.length > 0 && (<p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Added: {entry.added.join(', ')}</p>)}
                  {entry.activeListening && entry.activeListening.length > 0 && (<p className="text-xs mt-1 flex items-center gap-1" style={{ color: l.deep }}><Check size={11} /> Practised active listening</p>)}
                  {entry.analysis && (<p className="text-xs mt-1" style={{ color: l.deep }}>{CONV_STATES[entry.analysis.conversationState] ? `${CONV_STATES[entry.analysis.conversationState].emoji} ${CONV_STATES[entry.analysis.conversationState].label}, ` : ''}grading {entry.analysis.grading.overall}%</p>)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
