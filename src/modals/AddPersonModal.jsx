// Add someone new to your circle, in three steps:
//   name    their name, and an avatar (← → once you're out of the name box);
//           Enter goes on to the questions, L skips them
//   quiz    "How close are you two?" (components/ClosenessQuiz.jsx): Y, S or
//           N answers, Backspace goes back, L picks their layer yourself
//   result  where that puts them; 1-4 picks another layer, Q asks again,
//           Enter adds them
// Backspace goes back a step from anywhere but the name box.

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { QuizQuestion, QuizResult } from '../components/ClosenessQuiz.jsx';
import { quizKey, useCloseness } from '../components/closenessKeys.js';
import { PERSON_EMOJIS } from '../data/constants.js';
import { COLORS } from '../theme.js';

const STEP_ORDER = ['name', 'quiz', 'result'];

export function AddPersonModal({ onClose, onSave }) {
  const [step, setStep] = useState('name');
  const [dir, setDir] = useState(null); // the slide for the step just shown
  const [emoji, setEmoji] = useState(PERSON_EMOJIS[0]);
  const [name, setName] = useState('');
  const quiz = useCloseness();
  const who = name.trim();
  const canGo = who.length > 0;

  function go(next) { setDir(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 'in' : 'back'); setStep(next); }
  function startQuiz() { if (canGo) { quiz.restart(); go('quiz'); } }
  function pickOwn() { if (canGo) go('result'); }
  function save() { if (canGo) onSave({ name: who, emoji, layer: quiz.placement.layer, overall: quiz.placement.overall }); }
  // Back a step: from the result to the last question (or the name, if
  // the questions were skipped), and question by question to the name.
  function goBack() {
    if (step === 'quiz') { if (quiz.answers.length) quiz.back(); else go('name'); }
    else if (step === 'result') { if (quiz.answers.length) { quiz.back(); go('quiz'); } else go('name'); }
  }
  function nextEmoji(by) { setEmoji(e => PERSON_EMOJIS[(PERSON_EMOJIS.indexOf(e) + by + PERSON_EMOJIS.length) % PERSON_EMOJIS.length]); }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    const act = (fn) => { e.preventDefault(); fn(); };
    if (step === 'name') {
      if (e.key === 'Enter') act(startQuiz);
      else if (key === 'l') act(pickOwn);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') act(() => nextEmoji(e.key === 'ArrowLeft' ? -1 : 1));
      else if (key === 'n') act(() => document.getElementById('add-person-name')?.focus());
    } else if (step === 'quiz') {
      if (key === 'l') act(() => go('result'));
      else quizKey(e, quiz, { onDone: () => go('result'), onBackOut: () => go('name') });
    } else if (step === 'result') {
      if (/^[1-4]$/.test(e.key)) act(() => quiz.choose(Number(e.key)));
      else if (key === 'q') act(startQuiz);
      else if (e.key === 'Enter') act(save);
      else if (e.key === 'Backspace') act(goBack);
    }
  }

  const titles = { name: 'Add someone new', quiz: `How close are you and ${who}?`, result: `Adding ${who}` };
  const footer = step === 'name' ? (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={startQuiz} disabled={!canGo} className="primary-btn">Next: how close are you? <Kbd onAccent>↵</Kbd></button>
      <button type="button" onClick={pickOwn} disabled={!canGo} className="text-xs font-semibold flex items-center justify-center gap-1.5 py-1" style={{ color: canGo ? COLORS.accent : COLORS.inkSoft }}>Skip the questions and pick their layer <Kbd>L</Kbd></button>
    </div>
  ) : step === 'result' ? (
    <button type="button" onClick={save} className="primary-btn">Add {who} to my circle <Kbd onAccent>↵</Kbd></button>
  ) : null;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={step !== 'name' ? goBack : undefined} onKey={onKey} footer={footer} tall>
      <div key={step} className={dir === 'in' ? 'step-in' : dir === 'back' ? 'step-back' : ''}>
        {step === 'name' && (
          <>
            <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Name</p>
            <input id="add-person-name" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); startQuiz(); } }}
              aria-label="Their name" placeholder="Their name" className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}` }} />
            <p className="text-sm font-semibold mb-2 flex items-center justify-between gap-2" style={{ color: COLORS.ink }}>Choose an avatar<span className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Kbd>←</Kbd><Kbd>→</Kbd></span></p>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Avatar">
              {PERSON_EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => setEmoji(e)} aria-pressed={emoji === e} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 20 }}>{e}</button>
              ))}
            </div>
            <p className="text-xs mt-5" style={{ color: COLORS.inkSoft }}>Next, a few quick questions about how close you are, from saying hi in a corridor to watching a movie together. They place {who || 'them'} on the right layer.</p>
          </>
        )}
        {step === 'quiz' && quiz.at !== null && <QuizQuestion quiz={quiz} name={who} onDone={() => go('result')} />}
        {step === 'result' && <QuizResult quiz={quiz} name={who} emoji={emoji} />}
      </div>
    </Sheet>
  );
}
