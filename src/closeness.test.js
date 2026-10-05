// The closeness quiz (lib/closeness.js): which questions it asks, and where
// the answers place someone.
import { describe, expect, it } from 'vitest';
import { nextQuestion, QUIZ, quizPlacement } from './lib/closeness.js';
import { makePerson } from './lib/progress.js';

// Answer with a pattern until the quiz stops; returns the answers given.
function take(pattern) {
  const answers = [];
  while (nextQuestion(answers) !== null) answers.push(pattern[answers.length] ?? 0);
  return answers;
}
const Y = 1; const S = 0.5; const N = 0;

describe('the questions', () => {
  it('go from small talk to trust, each layer in turn', () => {
    expect(QUIZ.map(q => q.layer)).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
    expect(QUIZ[0].text('Sam')).toBe('Would Sam say hi if you passed each other in a corridor?');
    expect(QUIZ[5].text('Sam')).toMatch(/watching a movie with Sam/);
  });

  it('stop once a layer is mostly not yes, so a nodding acquaintance takes two', () => {
    expect(take([N, N])).toHaveLength(2);
    expect(take([Y, Y, N, N, N])).toHaveLength(5);
    expect(take([Y, Y, Y, Y, Y, N, N, N])).toHaveLength(8);
    expect(take(Array(11).fill(Y))).toHaveLength(11);
  });
});

describe('where the answers place them', () => {
  it('the deepest layer reached, and how far into it', () => {
    expect(quizPlacement(take([N, N]))).toEqual({ layer: 1, overall: 5 });
    expect(quizPlacement(take([Y, Y, N, N, N]))).toEqual({ layer: 1, overall: 40 });
    expect(quizPlacement(take([Y, Y, Y, Y, Y, N, N, N]))).toEqual({ layer: 2, overall: 40 });
    expect(quizPlacement(take([Y, Y, Y, Y, Y, Y, S, N]))).toEqual({ layer: 2, overall: 70 }); // Layer 3 not quite
    expect(quizPlacement(take([Y, Y, Y, Y, Y, Y, Y, N, N, N, N]))).toEqual({ layer: 3, overall: 27 });
    expect(quizPlacement(take(Array(11).fill(Y)))).toEqual({ layer: 4, overall: 90 });
  });

  it('"sort of" to everything is not close', () => {
    const answers = take(Array(11).fill(S));
    expect(answers).toHaveLength(2);
    expect(quizPlacement(answers)).toEqual({ layer: 1, overall: 20 });
  });

  it('a new person starts there, as Adjust would place them', () => {
    const p = makePerson({ name: 'Sam', emoji: '🙂', layer: 2, overall: 40 });
    expect(p).toMatchObject({ layer: 2, overall: 40 });
    expect(makePerson({ name: 'Ana', emoji: '🙂', layer: 4, overall: 90 })).toMatchObject({ layer: 4 });
    expect(makePerson({ name: 'Jo', emoji: '🙂', layer: 3 }).overall).toBe(20); // no quiz: the usual start
  });
});
