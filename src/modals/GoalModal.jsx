// Create or edit a goal (the full editor; QuickGoalSheet is the small one).
// Keys: ← → who it's for (a new goal), 1-7 a relationship goal, S the next
// social-skill goal (Shift+S back), C your own (its title box), V a more
// specific version of the one picked (the chevron), E the description, D the
// due date (none, 2 weeks, a month, 3 months), Enter saves. Esc or Tab leaves
// a text box.

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Avatar, KeyedField, Kbd } from '../components/atoms.jsx';
import { DateDropdown } from '../components/pickers.jsx';
import { getLayer, PRESET_VARIANTS, presetMeta, PRESETS } from '../data/constants.js';
import { formatAbsoluteDate, toISODate } from '../lib/dates.js';
import { generateGoalDescription } from '../lib/progress.js';
import { uid } from '../lib/util.js';
import { COLORS } from '../theme.js';

const DUE_STEPS = [null, 14, 30, 90]; // D: days from today
const focusField = (id) => { const el = document.getElementById(id); if (el) { el.focus(); if (el.select) el.select(); } };

export function GoalModal({ people, defaultPersonId, editingGoal, editingPersonId, onClose, onSave }) {
  const isEdit = !!editingGoal;
  const [personId, setPersonId] = useState(isEdit ? editingPersonId : (defaultPersonId !== undefined ? defaultPersonId : (people[0] && people[0].id) || null));
  const [presetKey, setPresetKey] = useState(editingGoal ? editingGoal.type : null);
  const [customTitle, setCustomTitle] = useState(isEdit && editingGoal.type === 'custom' ? editingGoal.title : '');
  const [description, setDescription] = useState(editingGoal ? editingGoal.description : '');
  const [descTouched, setDescTouched] = useState(isEdit);
  const [dueDate, setDueDate] = useState(isEdit && editingGoal.dueDate ? new Date(editingGoal.dueDate + 'T00:00:00') : null);
  const [dueStep, setDueStep] = useState(0); // where D is in DUE_STEPS
  const [variantPickerFor, setVariantPickerFor] = useState(null);

  // A preset's description mentions the person, so it's rewritten when you
  // pick someone else (unless you've typed or picked your own).
  function choosePerson(id) {
    setPersonId(id);
    if (presetKey && presetKey !== 'custom' && !descTouched) {
      const preset = presetMeta(presetKey);
      setDescription(preset ? generateGoalDescription(preset, people.find(p => p.id === id)) : '');
    }
  }

  function pickPreset(key) {
    setPresetKey(key);
    if (key !== 'custom' && !descTouched) {
      const preset = presetMeta(key);
      const person = people.find(p => p.id === personId);
      setDescription(preset ? generateGoalDescription(preset, person) : '');
    }
  }
  function pickVariant(variant) { setDescription(variant); setDescTouched(true); setVariantPickerFor(null); }

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
  const whoIds = [null, ...people.map(p => p.id)];

  function stepDue(back) {
    const next = (dueStep + (back ? DUE_STEPS.length - 1 : 1)) % DUE_STEPS.length;
    setDueStep(next);
    const days = DUE_STEPS[next];
    if (days === null) { setDueDate(null); return; }
    const now = new Date();
    setDueDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    const num = /^[1-9]$/.test(e.key) ? Number(e.key) : null;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (e.key === 'Enter') act(handleSave);
    else if (num && relPresets[num - 1]) act(() => pickPreset(relPresets[num - 1].key));
    else if (key === 's') {
      act(() => {
        const i = skillPresets.findIndex(p => p.key === presetKey);
        const next = i < 0 ? (e.shiftKey ? skillPresets.length - 1 : 0) : (i + (e.shiftKey ? skillPresets.length - 1 : 1)) % skillPresets.length;
        pickPreset(skillPresets[next].key);
      });
    } else if (key === 'c') act(() => { pickPreset('custom'); setTimeout(() => focusField('goal-custom-title'), 0); });
    else if (key === 'v' && presetKey && PRESET_VARIANTS[presetKey]) act(() => setVariantPickerFor(presetKey));
    else if (key === 'e') act(() => focusField('goal-description'));
    else if (key === 'd') act(() => stepDue(e.shiftKey));
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !isEdit) {
      act(() => {
        const i = whoIds.indexOf(personId);
        choosePerson(whoIds[(i + (e.key === 'ArrowLeft' ? whoIds.length - 1 : 1)) % whoIds.length]);
      });
    }
  }
  // In the versions sheet: 1-6 pick one.
  function onVariantKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    const list = PRESET_VARIANTS[variantPickerFor] || [];
    const num = /^[1-9]$/.test(e.key) ? Number(e.key) : null;
    if (num && list[num - 1]) { e.preventDefault(); pickVariant(list[num - 1]); }
  }

  const heading = (text, hint) => <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: COLORS.ink }}>{text}{hint}</p>;
  // A preset's tile, and the chevron (V) for its more specific versions once it's picked.
  function presetTile(preset, n) {
    const active = presetKey === preset.key;
    const hasVariants = active && PRESET_VARIANTS[preset.key];
    return (
      <div key={preset.key} className="relative">
        <button type="button" onClick={() => pickPreset(preset.key)} aria-pressed={active} aria-label={preset.label} className="w-full h-full rounded-2xl p-3 text-left" style={{ background: active ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}` }}>
          <span className="flex items-center justify-between gap-1"><span style={{ fontSize: 18 }}>{preset.emoji}</span>{n && <Kbd>{n}</Kbd>}</span>
          <p className="text-xs font-semibold mt-1" style={{ color: active ? COLORS.accent : COLORS.ink, paddingRight: hasVariants ? 26 : 0 }}>{preset.label}</p>
        </button>
        {hasVariants && (
          <button type="button" onClick={() => setVariantPickerFor(preset.key)} aria-label={`More specific versions of ${preset.label} (V)`} title="More specific versions (V)"
            style={{ position: 'absolute', bottom: 10, right: 10, width: 26, height: 26, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
            <ChevronRight size={16} color={COLORS.onAccent} />
          </button>
        )}
      </div>
    );
  }

  return (
    <Sheet title={isEdit ? 'Edit goal' : 'New goal'} onClose={onClose} onKey={onKey}
      footer={<button onClick={handleSave} disabled={!canSave} className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? COLORS.onAccent : COLORS.inkSoft }}>{isEdit ? 'Save changes' : 'Create goal'}{canSave && <Kbd onAccent>↵</Kbd>}</button>}>

      {heading('Who is this goal for?', !isEdit && <><Kbd>←</Kbd><Kbd>→</Kbd></>)}
      {isEdit ? (
        <div className="flex items-center gap-2 mb-5">
          {editingPerson ? (<><Avatar person={editingPerson} size={36} ringColor={COLORS.accent} /><span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{editingPerson.name}</span></>) : (<><Avatar emoji="🎯" size={36} ringColor={COLORS.accent} /><span className="text-sm font-semibold" style={{ color: COLORS.ink }}>My skills (general)</span></>)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, rowGap: 12, paddingBottom: 4, marginBottom: 20, maxHeight: 168, overflowY: 'auto' }}>
          <button onClick={() => choosePerson(null)} aria-pressed={personId === null} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 60 }}>
            <Avatar emoji="🎯" size={44} ringColor={personId === null ? COLORS.accent : COLORS.line} />
            <span className="text-xs" style={{ color: personId === null ? COLORS.accent : COLORS.inkSoft, fontWeight: personId === null ? 700 : 500 }}>General</span>
          </button>
          {people.map(p => {
            const active = personId === p.id; const l = getLayer(p.layer);
            return (
              <button key={p.id} onClick={() => choosePerson(p.id)} aria-pressed={active} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                <Avatar person={p} size={44} ringColor={active ? COLORS.accent : l.color} />
                <span className="text-xs truncate" style={{ maxWidth: 56, color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {heading('Relationship goals', <Kbd>1–{relPresets.length}</Kbd>)}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {relPresets.map((preset, i) => presetTile(preset, i + 1))}
      </div>

      {heading('Social-skill goals', <Kbd>S</Kbd>)}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {skillPresets.map(preset => presetTile(preset, null))}
      </div>

      <button type="button" onClick={() => pickPreset('custom')} aria-pressed={presetKey === 'custom'} aria-label={customPreset.label} className="w-full rounded-2xl p-3 text-left mb-4 flex items-center" style={{ background: presetKey === 'custom' ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${presetKey === 'custom' ? COLORS.accent : COLORS.line}` }}>
        <span style={{ fontSize: 18 }}>{customPreset.emoji}</span>
        <span className="text-xs font-semibold ml-2 flex-1" style={{ color: presetKey === 'custom' ? COLORS.accent : COLORS.ink }}>{customPreset.label}</span>
        <Kbd>C</Kbd>
      </button>

      {presetKey === 'custom' && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Goal title</p>
          <KeyedField letter="C" id="goal-custom-title" value={customTitle} onChange={e => setCustomTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
            aria-label="Goal title" placeholder="e.g. Meet their family" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
        </div>
      )}

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Description</p>
      <KeyedField letter="E" id="goal-description" wrapClassName="mb-5" value={description} onChange={e => { setDescription(e.target.value); setDescTouched(true); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
        aria-label="Description" placeholder="Describe a measurable target" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: COLORS.ink }}>Due date <span style={{ fontWeight: 500, color: COLORS.inkSoft }}>(optional)</span><Kbd>D</Kbd></p>
        <button type="button" onClick={() => { setDueDate(dueDate ? null : new Date()); setDueStep(0); }} aria-label={dueDate ? 'Turn off due date' : 'Turn on due date'} style={{ width: 42, height: 24, borderRadius: 999, background: dueDate ? COLORS.accent : COLORS.line, position: 'relative', flexShrink: 0, border: 'none', padding: 0, cursor: 'pointer' }}>
          <span style={{ position: 'absolute', top: 2, left: dueDate ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </button>
      </div>
      {dueDate && (
        <div>
          <DateDropdown value={dueDate} onChange={setDueDate} />
        </div>
      )}

      {variantPickerFor && PRESET_VARIANTS[variantPickerFor] && (
        <Sheet title={presetMeta(variantPickerFor).label} onClose={() => setVariantPickerFor(null)} onKey={onVariantKey}>
          <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>Pick the version that's closest to what you actually want right now.</p>
          <div className="flex flex-col gap-2">
            {PRESET_VARIANTS[variantPickerFor].map((variant, i) => (
              <button key={i} onClick={() => pickVariant(variant)} aria-label={variant} className="w-full text-left text-sm rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                <span className="shrink-0"><Kbd>{i + 1}</Kbd></span><span>{variant}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}
