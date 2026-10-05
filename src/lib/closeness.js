// "How close are you two?": the quick quiz when you add someone. A few
// questions, from saying hi in a corridor to trusting each other with
// something serious, each answered Yes, Sort of or No. Each layer has its
// own questions, and you've reached a layer when its answers are mostly yes
// (REACHED). Deeper questions only come while you have, so someone you only
// nod to takes two or three questions and a best friend all eleven.
//
// quizPlacement(answers) says where that puts them: the layer, and how far
// into it (5-90%), which makePerson starts them at.

export const QUIZ = [
  { layer: 1, text: (n) => `Would ${n} say hi if you passed each other in a corridor?` },
  { layer: 1, text: (n) => `Do you know a few basics about ${n}, like what they do or study?` },
  { layer: 2, text: (n) => `Could you chat with ${n} for five minutes without it feeling awkward?` },
  { layer: 2, text: (n) => `Do you know what ${n} is into, like their hobbies, shows or music?` },
  { layer: 2, text: (n) => `Would ${n} message you first, about anything at all?` },
  { layer: 3, text: (n) => `Would you be comfortable watching a movie with ${n}, just the two of you?` },
  { layer: 3, text: (n) => `Has ${n} told you something personal, like a worry or a hope?` },
  { layer: 3, text: (n) => `After a bad day, would you tell ${n} how you're really feeling?` },
  { layer: 4, text: (n) => `If something went really wrong, would ${n} be one of the first you'd tell?` },
  { layer: 4, text: (n) => `Would ${n} come to you for help with something serious?` },
  { layer: 4, text: (n) => `Could you sit in silence with ${n} and it still feel comfortable?` },
];

// What each answer counts for, and its key.
export const ANSWERS = [
  { key: 'Y', value: 1, label: 'Yes' },
  { key: 'S', value: 0.5, label: 'Sort of' },
  { key: 'N', value: 0, label: 'No' },
];

// A layer is reached when its answers average this or more: more yes than
// sort of, so "sort of" to everything doesn't make someone close.
const REACHED = 0.6;

const inLayer = (layer) => QUIZ.map((q, i) => (q.layer === layer ? i : -1)).filter(i => i >= 0);
// A layer's answers, averaged (0-1); unasked questions count as no.
function share(answers, layer) {
  const idx = inLayer(layer);
  return idx.reduce((sum, i) => sum + (i < answers.length ? answers[i] : 0), 0) / idx.length;
}

// The next question to ask (its index in QUIZ), or null when it's done.
export function nextQuestion(answers) {
  const i = answers.length;
  if (i >= QUIZ.length) return null;
  const last = i > 0 ? QUIZ[i - 1].layer : null;
  if (last !== null && QUIZ[i].layer !== last && share(answers, last) < REACHED) return null;
  return i;
}

// { layer, overall }: the deepest layer reached, and how far into it, from
// how sure that layer is and how much of the next one is there already.
export function quizPlacement(answers) {
  const shares = [1, 2, 3, 4].map(l => share(answers, l));
  let layer = 1;
  for (let l = 2; l <= 4; l++) if (shares[l - 1] >= REACHED) layer = l;
  const here = shares[layer - 1];
  const raw = layer < 4
    ? 100 * (0.4 * here + 0.6 * shares[layer])
    : 10 + ((here - REACHED) / (1 - REACHED)) * 80;
  return { layer, overall: Math.max(5, Math.min(90, Math.round(raw))) };
}
