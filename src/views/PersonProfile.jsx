// One person's profile screen.

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Plus } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sheet } from '../components/Sheet.jsx';
import { Avatar, CircularProgress, LabeledBar, LayerBadge, Timeline } from '../components/atoms.jsx';
import { GoalRow, InfoItemRow } from '../components/rows.jsx';
import { CATEGORIES, DIM_COLORS, DIM_LABELS, DIM_ORDER, getLayer } from '../data/constants.js';
import { parseISODay, sortByDay, sortHistory } from '../lib/dates.js';
import { computeOverall, dimsEqual, placeOnLayers, progressDelta } from '../lib/progress.js';
import { buildPotentialHooks, generateSuggestions } from '../lib/text.js';
import { COLORS } from '../theme.js';

function AdjustSlider({ label, value, onChange, color }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: COLORS.ink }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>{value}%</span>
      </div>
      <input type="range" min="0" max="100" value={value} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: color }} />
    </div>
  );
}

function PrepareTipsModal({ person, journal, onClose, onOpenFullCoach }) {
  const hooks = buildPotentialHooks(person, journal);
  return (
    <Sheet title={`Prepare to talk to ${person.name}`} onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>Prompts, not scripts — things worth noticing an opening for, based on what you've saved.</p>
      {hooks.length > 0 ? (
        <div className="flex flex-col gap-2 mb-5">
          {hooks.map(h => (
            <div key={h.key} className="rounded-xl px-3.5 py-3" style={{ background: COLORS.accentSoft }}>
              <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>{h.label}</p>
              <p className="text-sm mt-0.5" style={{ color: COLORS.ink }}>{h.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl p-4 mb-5" style={{ background: COLORS.paperRaised, border: `1px dashed ${COLORS.line}` }}>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>No saved information for {person.name} yet</p>
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Quick-add an interest or two on their profile and tips will show up here.</p>
        </div>
      )}
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Listen → Follow-up → Share</p>
      <p className="text-xs mb-5" style={{ color: COLORS.inkSoft }}>Listen for what they bring up, ask a genuine follow-up before changing topics, then share something of your own if it fits.</p>
      <button onClick={onOpenFullCoach} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.accent }}>Open full Conversation Coach</button>
    </Sheet>
  );
}

export function PersonProfile({ today, person, journal, onBack, onOpenLog, onOpenGoalCreate, onOpenGoalEdit, onDeleteGoal, onBumpGoal, onOpenAddInfo, onOpenQuickAddInterest, onSaveInfo, onDeleteInfo, onToggleTemporary, onToggleArchive, onAdjust, onOpenCoach, onEditPerson, onClearLevelUpFlag, onRemindFollowUp }) {
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [draft, setDraft] = useState(person.dims);
  const [showArchived, setShowArchived] = useState({});
  const l = getLayer(person.layer);
  // `today` changes at midnight, so suggestions age even while the app stays open.
  const suggestions = useMemo(() => generateSuggestions(person, parseISODay(today) || new Date()), [person, today]);

  useEffect(() => {
    if (!person.justLeveledUp) return;
    const t = setTimeout(() => onClearLevelUpFlag(person.id), 2700);
    return () => clearTimeout(t);
  }, [person.justLeveledUp, person.id, onClearLevelUpFlag]);

  function openAdjust() { setDraft(person.dims); setShowAdjust(true); }
  // Saving untouched sliders just closes the panel; nothing moves.
  function saveAdjust() { if (!dimsEqual(draft, person.dims)) onAdjust(draft); setShowAdjust(false); }
  // Where saving would put them, shown before you save.
  const preview = showAdjust ? placeOnLayers(computeOverall(draft)) : null;
  const change = person.lastChange
    ? { ...person.lastChange, beforeLayer: person.lastChange.beforeLayer || person.layer, afterLayer: person.lastChange.afterLayer || person.layer }
    : null;
  const changeDelta = change ? progressDelta({ layer: change.beforeLayer, overall: change.before }, { layer: change.afterLayer, overall: change.after }) : 0;

  return (
    <div className="fade-anim px-5 pt-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium" style={{ color: COLORS.inkSoft }}>
          <ChevronLeft size={18} /> Back
        </button>
        <button onClick={onEditPerson} className="flex items-center gap-1 text-xs font-medium" style={{ color: COLORS.inkSoft }}>
          <Pencil size={13} /> Edit
        </button>
      </div>

      <div className="flex flex-col items-center text-center">
        <Avatar emoji={person.emoji} size={72} ringColor={l.color} />
        <p className="font-display mt-3" style={{ fontSize: 24, color: COLORS.ink }}>{person.name}</p>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Current relationship stage</p>
        <div className="mt-1.5"><LayerBadge layerId={person.layer} /></div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => onOpenLog(person.id)} className="text-xs font-semibold rounded-full px-4 py-2" style={{ background: COLORS.accent, color: '#fff' }}>Log an interaction</button>
          <button onClick={() => setPrepareOpen(true)} className="text-xs font-semibold rounded-full px-4 py-2" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Prepare to talk</button>
        </div>
      </div>

      <div className="flex flex-col items-center mt-7">
        <div className={person.justLeveledUp ? 'level-up-pulse' : ''} style={{ position: 'relative' }}>
          {person.justLeveledUp && (
            <div className="level-up-banner" style={{ position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: l.color, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 999, boxShadow: `0 6px 16px ${l.tint}` }}>
              🎉 Reached Layer {person.layer}!
            </div>
          )}
          <CircularProgress percent={person.overall} size={160} stroke={13} color={l.color} label={`Progress in Layer ${person.layer}`} />
        </div>
        <p className="text-xs text-center mt-3" style={{ color: COLORS.inkSoft, maxWidth: 300 }}>
          {person.layer < 4
            ? `${person.overall}% toward Layer ${person.layer + 1}: ${getLayer(person.layer + 1).name}. Based on your logged interactions — an estimate, not an objective measurement.`
            : `${person.overall}% within Layer 4, the deepest layer. Based on your logged interactions — an estimate, not an objective measurement.`}
        </p>
      </div>

      {change && (
        <div className="mt-5 rounded-2xl p-4" style={{ background: l.tint }}>
          {/* Across a layer change the percentages restart, so the card names
              both layers and counts the gain through them (it used to say +0%). */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: l.deep }}>
              {change.beforeLayer !== change.afterLayer
                ? `Layer ${change.beforeLayer} · ${change.before}% → Layer ${change.afterLayer} · ${change.after}%`
                : `${change.before}% → ${change.after}%`}
            </p>
            <p className="text-sm font-semibold" style={{ color: l.deep }}>{changeDelta >= 0 ? '+' : '−'}{Math.abs(changeDelta)}%</p>
          </div>
          <p className="text-xs mt-1 mb-1.5" style={{ color: COLORS.inkSoft }}>Why:</p>
          {change.why.map((w, i) => (<p key={i} className="text-xs" style={{ color: COLORS.ink }}>✓ {w}</p>))}
        </div>
      )}

      <div className="mt-7 space-y-3.5">
        {DIM_ORDER.map(k => (<LabeledBar key={k} label={DIM_LABELS[k]} percent={person.dims[k]} color={DIM_COLORS[k]} size="lg" />))}
      </div>

      <div className="text-center mt-3">
        <button onClick={showAdjust ? saveAdjust : openAdjust} className="text-xs font-medium" style={{ color: COLORS.accent }}>{showAdjust ? 'Save changes' : 'Adjust manually'}</button>
        {showAdjust && <button onClick={() => setShowAdjust(false)} className="text-xs font-medium ml-3" style={{ color: COLORS.inkSoft }}>Cancel</button>}
      </div>

      {showAdjust && (
        <div className="mt-3 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>These are your own impressions, not precise measurements. Adjust them any time.</p>
          {DIM_ORDER.map(k => (<AdjustSlider key={k} label={DIM_LABELS[k]} value={draft[k]} onChange={v => setDraft(d => ({ ...d, [k]: v }))} color={DIM_COLORS[k]} />))}
          <p className="text-xs mt-1" role="status" style={{ color: preview && preview.layer !== person.layer ? COLORS.accent : COLORS.inkSoft, fontWeight: preview && preview.layer !== person.layer ? 600 : 400 }}>
            {dimsEqual(draft, person.dims)
              ? 'Move a slider to change these. Saving now changes nothing.'
              : `Saving puts ${person.name} at Layer ${preview.layer}: ${getLayer(preview.layer).name}, ${preview.overall}% (now ${preview.layer !== person.layer ? `Layer ${person.layer}, ` : ''}${person.overall}%).`}
          </p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-7">
          <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Ideas for next time</p>
          <div className="mt-2.5 space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-2xl p-3.5" style={{ background: l.tint }}>
                <p className="text-sm" style={{ color: COLORS.ink }}>💡 {s.headline}</p>
                <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7">
        <div className="flex items-center justify-between">
          <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Goals</p>
          <button onClick={() => onOpenGoalCreate(person.id)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.accent }}><Plus size={14} /> Add goal</button>
        </div>
        <div className="mt-3">
          {person.goals.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>No goals yet for {person.name}. Add one to start tracking progress.</p>
          ) : person.goals.map(g => (
            <GoalRow key={g.id} goal={g} color={l.color} today={today}
              onBump={() => onBumpGoal(person.id, g.id)}
              onEdit={() => onOpenGoalEdit(person.id, g)}
              onDelete={() => onDeleteGoal(person.id, g.id, g.title)} />
          ))}
        </div>
      </div>

      <div className="mt-7">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>What I know about {person.name}</p>
        <div className="mt-2">
          {CATEGORIES.map(cat => {
            const active = person[cat.key].filter(i => !i.archived);
            const archived = person[cat.key].filter(i => i.archived);
            return (
              <div key={cat.key} className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{cat.label}</p>
                  <div className="flex items-center gap-2">
                    {cat.key === 'interests' && (
                      <button onClick={() => onOpenQuickAddInterest(person.id)} className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Quick add</button>
                    )}
                    <button onClick={() => onOpenAddInfo(person.id, cat.key)} className="p-1"><Plus size={16} color={COLORS.accent} /></button>
                  </div>
                </div>
                {active.length === 0 ? (
                  <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Nothing here yet. Add the first thing you know.</p>
                ) : (
                  <div className="mt-1">
                    {active.map(item => (
                      <InfoItemRow key={item.id} item={item}
                        onSave={(text) => onSaveInfo(person.id, cat.key, item.id, text)}
                        onDelete={() => onDeleteInfo(person.id, cat.key, item.id, item.text)}
                        onToggleTemporary={() => onToggleTemporary(person.id, cat.key, item.id)}
                        onToggleArchive={() => onToggleArchive(person.id, cat.key, item.id)}
                        onRemind={onRemindFollowUp ? () => onRemindFollowUp(person.id, item) : undefined} />
                    ))}
                  </div>
                )}
                {archived.length > 0 && (
                  <div className="mt-1">
                    <button onClick={() => setShowArchived(s => ({ ...s, [cat.key]: !s[cat.key] }))} className="text-xs font-medium mt-1" style={{ color: COLORS.inkSoft }}>
                      {showArchived[cat.key] ? 'Hide' : 'Show'} archived ({archived.length})
                    </button>
                    {showArchived[cat.key] && archived.map(item => (
                      <InfoItemRow key={item.id} item={item}
                        onSave={(text) => onSaveInfo(person.id, cat.key, item.id, text)}
                        onDelete={() => onDeleteInfo(person.id, cat.key, item.id, item.text)}
                        onToggleTemporary={() => onToggleTemporary(person.id, cat.key, item.id)}
                        onToggleArchive={() => onToggleArchive(person.id, cat.key, item.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-7">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Relationship timeline</p>
        <div className="mt-3">
          <Timeline steps={[...sortByDay(person.timeline || []), { label: `Current: Layer ${person.layer}, ${l.name}`, at: today, prefix: 'As of ', current: true }]} />
        </div>
      </div>

      <div className="mt-2">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Progress</p>
        <div className="mt-3" style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sortHistory(person.history)} margin={{ top: 8, right: 14, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} padding={{ left: 18, right: 18 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={26} />
              <Tooltip formatter={(v) => [`${v}%`, 'Progress']} contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke={l.color} strokeWidth={2.5} dot={{ r: 3, fill: l.color }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs mt-3 text-center" style={{ color: COLORS.inkSoft }}>Relationships don't have to move in a straight line. It's normal to move between layers.</p>
      </div>

      {prepareOpen && <PrepareTipsModal person={person} journal={journal} onClose={() => setPrepareOpen(false)} onOpenFullCoach={() => { setPrepareOpen(false); onOpenCoach(person.id); }} />}
    </div>
  );
}
