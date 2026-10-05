// The "How close are you two?" quiz (lib/closeness.js), as pieces a sheet
// puts together: QuizQuestion shows one question with its three answers and
// QuizResult where the answers put them (1-4 to pick another layer). Its
// state and keys are useCloseness() and quizKey() (closenessKeys.js): Y, S
// or N (or 1-3) answers, Backspace goes back.
// Used when adding someone (AddPersonModal), and on its own sheet
// (QuizSheet) while setting up.

import { useEffect, useState } from 'react';
import { Sheet } from './Sheet.jsx';
import { isTabbedToButton, isTyping } from './sheetLayer.js';
import { Avatar, Kbd } from './atoms.jsx';
import { getLayer, LAYERS } from '../data/constants.js';
import { quizKey, useCloseness } from './closenessKeys.js';
import { ANSWERS, QUIZ } from '../lib/closeness.js';
import { COLORS } from '../theme.js';

const ANSWER_EMOJI = { Y: '👍', S: '🤷', N: '👎' };

// One dot per question, in its layer's colour once answered.
function QuizDots({ answers, at }) {
  return (
    <div className="flex items-center gap-1 mb-4" aria-hidden="true">
      {QUIZ.map((q, i) => {
        const l = getLayer(q.layer);
        const done = i < answers.length;
        return <span key={i} className="quiz-dot" style={{ background: done ? l.color : 'transparent', borderColor: i === at || done ? l.color : COLORS.line, opacity: done ? 0.4 + 0.6 * answers[i] : 1 }} />;
      })}
    </div>
  );
}

export function QuizQuestion({ quiz, name, onDone }) {
  const q = QUIZ[quiz.at];
  const l = getLayer(q.layer);
  return (
    <>
      <QuizDots answers={quiz.answers} at={quiz.at} />
      <div key={quiz.at} className="quiz-card step-in" style={{ background: l.tint, borderColor: l.color }}>
        <p className="text-xs font-bold" style={{ color: l.deep, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Question {quiz.at + 1} · {l.name}</p>
        <p className="font-display mt-2" role="heading" aria-level={3} style={{ fontSize: 21, lineHeight: 1.25, color: COLORS.ink }}>{q.text(name)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2.5 mt-4" role="group" aria-label="Your answer">
        {ANSWERS.map(a => (
          <button key={a.key} type="button" onClick={() => { if (quiz.answer(a.value)) onDone(); }} className="tile py-4 px-1 flex flex-col items-center gap-1.5">
            <Kbd>{a.key}</Kbd>
            <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{ANSWER_EMOJI[a.key]}</span>
            <span className="text-sm font-bold">{a.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs mt-4 text-center flex items-center justify-center gap-1 flex-wrap" style={{ color: COLORS.inkSoft }}>
        {quiz.answers.length ? <><Kbd>⌫</Kbd> the one before · </> : 'A few quick questions; it stops once it knows. '}
        <Kbd>L</Kbd> pick their layer yourself
      </p>
    </>
  );
}

// Where they're starting; 1-4 (or a tap) picks another layer.
export function QuizResult({ quiz, name, emoji }) {
  const { layer, overall } = quiz.placement;
  const l = getLayer(layer);
  return (
    <>
      <div className="rounded-3xl p-5 text-center pop" style={{ background: l.tint }} role="status" aria-label="Where you're starting">
        <div className="flex justify-center"><Avatar emoji={emoji} size={58} ringColor={l.color} /></div>
        <p className="font-display mt-2" style={{ fontSize: 22, color: COLORS.ink }}>{name}</p>
        <p className="text-sm font-bold mt-1" style={{ color: l.deep }}>Layer {l.id}: {l.fullName}{overall !== null ? ` · ${overall}% in` : ''}</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{l.desc}</p>
        {quiz.fromQuiz && quiz.placement === quiz.fromQuiz && (
          <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>From {quiz.answers.length} {quiz.answers.length === 1 ? 'answer' : 'answers'}. Time you log together moves you on from here.</p>
        )}
      </div>
      <p className="text-sm font-semibold mt-5 mb-2 flex items-center justify-between gap-2" style={{ color: COLORS.ink }}>
        {quiz.fromQuiz ? 'Not quite? Pick their layer' : 'Where are you starting from?'}
        <span className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Kbd>1</Kbd>–<Kbd>4</Kbd></span>
      </p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Their layer">
        {LAYERS.map(x => {
          const on = x.id === layer;
          return (
            <button key={x.id} type="button" onClick={() => quiz.choose(x.id)} aria-pressed={on} className="tile p-3 text-left flex items-center gap-2" style={{ paddingRight: 36, ...(on ? { background: x.tint, borderColor: x.color } : {}) }}>
              <span className="text-xs font-semibold flex-1" style={{ color: on ? x.deep : COLORS.ink }}>Layer {x.id}: {x.name}</span>
              <Kbd>{x.id}</Kbd>
            </button>
          );
        })}
      </div>
    </>
  );
}

// The quiz on its own sheet, for someone already named (setting up). The
// result's Enter keeps it (onDone(placement)); Esc leaves them as they were.
// Same keys as when adding someone, without the name step.
export function QuizSheet({ name, emoji, onDone, onClose }) {
  const quiz = useCloseness();
  const [step, setStep] = useState('quiz');
  // The name box underneath would keep the keys (it's still focused).
  useEffect(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }, []);
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    const act = (fn) => { e.preventDefault(); fn(); };
    if (step === 'quiz') {
      if (key === 'l') act(() => setStep('result'));
      else quizKey(e, quiz, { onDone: () => setStep('result'), onBackOut: () => {} });
    } else if (/^[1-4]$/.test(e.key)) act(() => quiz.choose(Number(e.key)));
    else if (key === 'q') act(() => { quiz.restart(); setStep('quiz'); });
    else if (e.key === 'Enter') act(() => onDone(quiz.placement));
    else if (e.key === 'Backspace') act(() => { if (quiz.answers.length) quiz.back(); setStep('quiz'); });
  }
  return (
    <Sheet title={step === 'quiz' ? `How close are you and ${name}?` : `Where you are with ${name}`} onClose={onClose} onKey={onKey} tall
      footer={step === 'result' ? <button type="button" onClick={() => onDone(quiz.placement)} className="primary-btn">Keep this <Kbd onAccent>↵</Kbd></button> : null}>
      <div key={step} className="step-in">
        {step === 'quiz' && quiz.at !== null ? <QuizQuestion quiz={quiz} name={name} onDone={() => setStep('result')} /> : <QuizResult quiz={quiz} name={name} emoji={emoji} />}
      </div>
    </Sheet>
  );
}
