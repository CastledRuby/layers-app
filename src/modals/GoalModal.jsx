// Create or edit a goal.

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { Avatar } from '../components/atoms.jsx';
import { DateDropdown } from '../components/pickers.jsx';
import { getLayer, PRESET_VARIANTS, presetMeta, PRESETS } from '../data/constants.js';
import { formatAbsoluteDate, toISODate } from '../lib/dates.js';
import { generateGoalDescription } from '../lib/progress.js';
import { uid } from '../lib/util.js';
import { COLORS } from '../theme.js';

export function GoalModal({ people, defaultPersonId, editingGoal, editingPersonId, onClose, onSave }) {
  const isEdit = !!editingGoal;
  const [personId, setPersonId] = useState(isEdit ? editingPersonId : (defaultPersonId !== undefined ? defaultPersonId : (people[0] && people[0].id) || null));
  const [presetKey, setPresetKey] = useState(editingGoal ? editingGoal.type : null);
  const [customTitle, setCustomTitle] = useState(isEdit && editingGoal.type === 'custom' ? editingGoal.title : '');
  const [description, setDescription] = useState(editingGoal ? editingGoal.description : '');
  const [descTouched, setDescTouched] = useState(isEdit);
  const [dueDate, setDueDate] = useState(isEdit && editingGoal.dueDate ? new Date(editingGoal.dueDate + 'T00:00:00') : null);
  const [variantPickerFor, setVariantPickerFor] = useState(null);

  function pickPreset(key) {
    setPresetKey(key);
    if (key !== 'custom' && !descTouched) {
      const preset = presetMeta(key);
      const person = people.find(p => p.id === personId);
      setDescription(preset ? generateGoalDescription(preset, person) : '');
    }
  }

  const editingPerson = isEdit ? people.find(p => p.id === editingPersonId) : null;
  const canSave = presetKey && description.trim() && (presetKey !== 'custom' || customTitle.trim());

  function handleSave() {
    if (!canSave) return;
    const preset = presetMeta(presetKey);
    const title = presetKey === 'custom' ? customTitle.trim() : preset.label;
    const goalData = { id: isEdit ? editingGoal.id : uid(), personId: personId || null, category: preset.category, type: presetKey, title, description: description.trim(), dueDate: dueDate ? toISODate(dueDate) : null, progress: isEdit ? editingGoal.progress : 0, history: isEdit ? editingGoal.history : [{ date: formatAbsoluteDate(new Date()), at: toISODate(new Date()), value: 0 }] };
    onSave(personId || null, goalData, isEdit);
  }

  const relPresets = PRESETS.filter(p => p.category === 'relationship');
  const skillPresets = PRESETS.filter(p => p.category === 'skill');
  const customPreset = PRESETS.find(p => p.category === 'custom');

  return (
    <Sheet title={isEdit ? 'Edit goal' : 'New goal'} onClose={onClose}
      footer={<button onClick={handleSave} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>{isEdit ? 'Save changes' : 'Create goal'}</button>}>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Who is this goal for?</p>
      {isEdit ? (
        <div className="flex items-center gap-2 mb-5">
          {editingPerson ? (<><Avatar emoji={editingPerson.emoji} size={36} ringColor={COLORS.accent} /><span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{editingPerson.name}</span></>) : (<><Avatar emoji="🎯" size={36} ringColor={COLORS.accent} /><span className="text-sm font-semibold" style={{ color: COLORS.ink }}>My skills (general)</span></>)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, rowGap: 12, paddingBottom: 4, marginBottom: 20, maxHeight: 168, overflowY: 'auto' }}>
          <button onClick={() => setPersonId(null)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 60 }}>
            <Avatar emoji="🎯" size={44} ringColor={personId === null ? COLORS.accent : COLORS.line} />
            <span className="text-xs" style={{ color: personId === null ? COLORS.accent : COLORS.inkSoft, fontWeight: personId === null ? 700 : 500 }}>General</span>
          </button>
          {people.map(p => {
            const active = personId === p.id; const l = getLayer(p.layer);
            return (
              <button key={p.id} onClick={() => setPersonId(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                <Avatar emoji={p.emoji} size={44} ringColor={active ? COLORS.accent : l.color} />
                <span className="text-xs truncate" style={{ maxWidth: 56, color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Relationship goals</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {relPresets.map(preset => {
          const active = presetKey === preset.key;
          const hasVariants = active && PRESET_VARIANTS[preset.key];
          return (
            <button key={preset.key} onClick={() => pickPreset(preset.key)} className="rounded-2xl p-3 text-left relative" style={{ background: active ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}` }}>
              <span style={{ fontSize: 18 }}>{preset.emoji}</span>
              <p className="text-xs font-semibold mt-1" style={{ color: active ? COLORS.accent : COLORS.ink, paddingRight: hasVariants ? 26 : 0 }}>{preset.label}</p>
              {hasVariants && (
                <span onClick={(e) => { e.stopPropagation(); setVariantPickerFor(preset.key); }} style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                  <ChevronRight size={16} color="#fff" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Social-skill goals</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {skillPresets.map(preset => {
          const active = presetKey === preset.key;
          const hasVariants = active && PRESET_VARIANTS[preset.key];
          return (
            <button key={preset.key} onClick={() => pickPreset(preset.key)} className="rounded-2xl p-3 text-left relative" style={{ background: active ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}` }}>
              <span style={{ fontSize: 18 }}>{preset.emoji}</span>
              <p className="text-xs font-semibold mt-1" style={{ color: active ? COLORS.accent : COLORS.ink, paddingRight: hasVariants ? 26 : 0 }}>{preset.label}</p>
              {hasVariants && (
                <span onClick={(e) => { e.stopPropagation(); setVariantPickerFor(preset.key); }} style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                  <ChevronRight size={16} color="#fff" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button onClick={() => pickPreset('custom')} className="w-full rounded-2xl p-3 text-left mb-4" style={{ background: presetKey === 'custom' ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${presetKey === 'custom' ? COLORS.accent : COLORS.line}` }}>
        <span style={{ fontSize: 18 }}>{customPreset.emoji}</span>
        <span className="text-xs font-semibold ml-2" style={{ color: presetKey === 'custom' ? COLORS.accent : COLORS.ink }}>{customPreset.label}</span>
      </button>

      {presetKey === 'custom' && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Goal title</p>
          <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="e.g. Meet their family" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
        </div>
      )}

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Description</p>
      <input value={description} onChange={e => { setDescription(e.target.value); setDescTouched(true); }} placeholder="Describe a measurable target" className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}` }} />

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Due date <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span></p>
        <button type="button" onClick={() => setDueDate(dueDate ? null : new Date())} aria-label={dueDate ? 'Turn off due date' : 'Turn on due date'} style={{ width: 42, height: 24, borderRadius: 999, background: dueDate ? COLORS.accent : COLORS.line, position: 'relative', flexShrink: 0, border: 'none', padding: 0, cursor: 'pointer' }}>
          <span style={{ position: 'absolute', top: 2, left: dueDate ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </button>
      </div>
      {dueDate && (
        <div style={{ position: 'relative', zIndex: 20 }}>
          <DateDropdown value={dueDate} onChange={setDueDate} />
        </div>
      )}

      {variantPickerFor && PRESET_VARIANTS[variantPickerFor] && (
        <Sheet title={presetMeta(variantPickerFor).label} onClose={() => setVariantPickerFor(null)}>
          <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>Pick the version that's closest to what you actually want right now.</p>
          <div className="flex flex-col gap-2">
            {PRESET_VARIANTS[variantPickerFor].map((variant, i) => (
              <button key={i} onClick={() => { setDescription(variant); setDescTouched(true); setVariantPickerFor(null); }} className="w-full text-left text-sm rounded-2xl px-4 py-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>{variant}</button>
            ))}
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}
