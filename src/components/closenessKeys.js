// The closeness quiz's state and keys (components/ClosenessQuiz.jsx shows
// it): useCloseness() holds the answers and any layer picked by hand, and
// quizKey() is a question's keys.

import { useState } from 'react';
import { ANSWERS, nextQuestion, quizPlacement } from '../lib/closeness.js';

// placement: { layer, overall } for makePerson (overall null: the layer's
// usual start).
export function useCloseness() {
  const [answers, setAnswers] = useState([]);
  const [chosen, setChosen] = useState(null); // a layer picked by hand
  const at = nextQuestion(answers);
  const fromQuiz = answers.length ? quizPlacement(answers) : null;
  const placement = chosen && (!fromQuiz || chosen !== fromQuiz.layer) ? { layer: chosen, overall: null } : fromQuiz || { layer: 1, overall: null };
  return {
    answers, at, fromQuiz, placement,
    // Answers the question showing; true when that was the last one needed.
    answer(value) {
      const next = [...answers, value];
      setAnswers(next);
      setChosen(null);
      return nextQuestion(next) === null;
    },
    back() { setAnswers(a => a.slice(0, -1)); },
    restart() { setAnswers([]); setChosen(null); },
    choose(layer) { setChosen(layer); },
  };
}

// A question's keys. onDone: the last answer is in; onBackOut: Backspace on
// the first question.
export function quizKey(e, quiz, { onDone, onBackOut }) {
  if (e.ctrlKey || e.metaKey || e.altKey || quiz.at === null) return false;
  const pick = ANSWERS.find(a => a.key === e.key.toUpperCase()) || (/^[1-3]$/.test(e.key) ? ANSWERS[Number(e.key) - 1] : null);
  if (pick) { e.preventDefault(); if (quiz.answer(pick.value)) onDone(); return true; }
  if (e.key === 'Backspace') { e.preventDefault(); if (quiz.answers.length) quiz.back(); else onBackOut(); return true; }
  return false;
}
