// Goals overview screen.

import { useMemo, useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { Avatar } from '../components/atoms.jsx';
import { GoalRow } from '../components/rows.jsx';
import { getLayer } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function GoalsView({ today, people, generalGoals, onBack, onOpenPerson, onOpenGoalCreate, onOpenGoalEdit, onDeleteGoal, onBumpGoal }) {
  const [filter, setFilter] = useState('active');
  const groups = useMemo(() => {
    const passFilter = g => filter === 'all' ? true : filter === 'active' ? g.progress < 100 : g.progress >= 100;
    const g1 = people.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: getLayer(p.layer).color, goals: p.goals.filter(passFilter) })).filter(g => g.goals.length > 0);
    const gen = generalGoals.filter(passFilter);
    const g2 = gen.length > 0 ? [{ id: null, name: 'My skills', emoji: '🎯', color: COLORS.accent, goals: gen }] : [];
    return [...g1, ...g2];
  }, [people, generalGoals, filter]);

  const totalActive = people.flatMap(p => p.goals).concat(generalGoals).filter(g => g.progress < 100).length;
  const totalDone = people.flatMap(p => p.goals).concat(generalGoals).filter(g => g.progress >= 100).length;

  return (
    <div className="fade-anim px-5 pt-6 pb-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium mb-4" style={{ color: COLORS.inkSoft }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div className="flex items-center justify-between">
        <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Goals</p>
        <button onClick={() => onOpenGoalCreate(null)} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accent, color: COLORS.onAccent }}>
          <Plus size={14} /> New goal
        </button>
      </div>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{totalActive} in progress, {totalDone} completed.</p>

      <div className="flex items-center gap-2 mt-4">
        {['active', 'completed', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: filter === f ? COLORS.accent : COLORS.paperRaised, color: filter === f ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${filter === f ? COLORS.accent : COLORS.line}` }}>
            {f === 'active' ? 'In progress' : f === 'completed' ? 'Completed' : 'All'}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {groups.length === 0 ? (
          <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>Nothing here yet. Add a goal to start tracking progress.</p>
        ) : groups.map(grp => (
          <div key={grp.id || 'general'} className="mb-5">
            <button onClick={() => grp.id && onOpenPerson(grp.id)} className="flex items-center gap-2 mb-2">
              <Avatar emoji={grp.emoji} size={26} ringColor={grp.color} />
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{grp.name}</span>
            </button>
            {grp.goals.map(g => (
              <GoalRow key={g.id} goal={g} color={grp.color} today={today}
                onBump={() => onBumpGoal(grp.id, g.id)}
                onEdit={() => onOpenGoalEdit(grp.id, g)}
                onDelete={() => onDeleteGoal(grp.id, g.id, g.title)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
