import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Home, Users, MessageCircle, BookOpen, User, Plus, X, ChevronLeft, Pencil, Trash2, Check, TrendingUp, UserPlus, Clock, Archive, Search, Download, Upload } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/* ============================== DESIGN TOKENS ============================== */

const THEME_LIGHT = {
  paper: '#F5F6F1',
  paperRaised: '#FFFFFF',
  ink: '#23283A',
  inkSoft: '#63697E',
  line: '#E4E3DC',
  accent: '#33506B',
  accentSoft: '#E7EEF1',
  layer1: '#8FB8C9', layer1Tint: '#E4EEF2', layer1Deep: '#3E6C7D',
  layer2: '#6FA98C', layer2Tint: '#E4EFE8', layer2Deep: '#3B6B54',
  layer3: '#C98A5B', layer3Tint: '#F3E6DA', layer3Deep: '#8C5A34',
  layer4: '#A8455C', layer4Tint: '#F1DEE2', layer4Deep: '#7A3145',
  plum: '#7C6A94',
  teal: '#5B8A8A',
  good: '#4C7F65',
  warn: '#B08B3E',
  alert: '#A8455C',
};

const THEME_DARK = {
  paper: '#1B1E27',
  paperRaised: '#242836',
  ink: '#EDEDE6',
  inkSoft: '#9A9FB0',
  line: '#363B4A',
  accent: '#7FA8C9',
  accentSoft: '#26313D',
  layer1: '#8FB8C9', layer1Tint: '#22303A', layer1Deep: '#BFE0EC',
  layer2: '#6FA98C', layer2Tint: '#1F2E28', layer2Deep: '#A9D6BE',
  layer3: '#C98A5B', layer3Tint: '#332420', layer3Deep: '#E8B98D',
  layer4: '#C97690', layer4Tint: '#33232A', layer4Deep: '#E8A9BC',
  plum: '#A08FBE',
  teal: '#7FB0B0',
  good: '#7FBFA0',
  warn: '#D9B168',
  alert: '#C97690',
};

// Every COLORS.x usage throughout the app resolves through a CSS custom
// property, so the whole app can flip between THEME_LIGHT and THEME_DARK
// (see .layers-root / .layers-root.dark in the CSS block) without any
// component needing to know which theme is active.
const COLORS = Object.fromEntries(Object.keys(THEME_LIGHT).map(k => [k, `var(--c-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())})`]));

const LAYERS = [
  { id: 1, name: 'Orientation', fullName: 'Orientation', color: COLORS.layer1, tint: COLORS.layer1Tint, deep: COLORS.layer1Deep, desc: 'Basic facts, introductions and small talk.' },
  { id: 2, name: 'Exploratory', fullName: 'Exploratory', color: COLORS.layer2, tint: COLORS.layer2Tint, deep: COLORS.layer2Deep, desc: 'Interests, opinions, hobbies and shared interests.' },
  { id: 3, name: 'Personal', fullName: 'Affective / Personal', color: COLORS.layer3, tint: COLORS.layer3Tint, deep: COLORS.layer3Deep, desc: 'Personal experiences, feelings, goals and meaningful moments.' },
  { id: 4, name: 'Close', fullName: 'Stable / Close', color: COLORS.layer4, tint: COLORS.layer4Tint, deep: COLORS.layer4Deep, desc: 'Strong trust, deeper understanding, vulnerability and mutual support.' },
];
function getLayer(id) { return LAYERS.find(l => l.id === id) || LAYERS[0]; }
function layerForOverall(overall) { return overall >= 75 ? 4 : overall >= 50 ? 3 : overall >= 25 ? 2 : 1; }

const DIM_ORDER = ['depth', 'trust', 'reciprocity', 'interaction', 'sharedExperiences', 'listening'];
const DIM_LABELS = { depth: 'Depth', trust: 'Trust', reciprocity: 'Reciprocity', interaction: 'Interaction', sharedExperiences: 'Shared experiences', listening: 'Listening / connection' };
const DIM_COLORS = { depth: COLORS.layer3, trust: COLORS.layer4, reciprocity: COLORS.plum, interaction: COLORS.layer1, sharedExperiences: COLORS.teal, listening: COLORS.layer2 };

function computeOverall(dims) {
  const vals = DIM_ORDER.map(k => dims[k]);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

const LAYER_BASE_DIMS = { 1: 10, 2: 30, 3: 55, 4: 80 };
function makePerson({ name, emoji, layer }) {
  const baseVal = LAYER_BASE_DIMS[layer] || 10;
  const dims = { depth: baseVal, trust: baseVal, reciprocity: baseVal, interaction: baseVal, sharedExperiences: baseVal, listening: baseVal };
  const overall = computeOverall(dims);
  return { id: uid(), name, emoji, layer: layer || 1, dims, overall, interests: [], preferences: [], plans: [], experiences: [], important: [], goals: [], history: [{ date: 'Today', value: overall }], timeline: [{ label: 'First met', date: 'Today' }] };
}

const CATEGORIES = [
  { key: 'interests', label: 'Interests', placeholder: 'e.g. Loves rock climbing', emoji: '⭐' },
  { key: 'preferences', label: 'Preferences', placeholder: 'e.g. Prefers tea over coffee', emoji: '❤️' },
  { key: 'plans', label: 'Plans', placeholder: 'e.g. Wants to run a marathon', emoji: '🗓️' },
  { key: 'experiences', label: 'Experiences', placeholder: 'e.g. Changed schools last year', emoji: '🧭' },
  { key: 'important', label: 'Important / temporary', placeholder: 'e.g. Big exam next Tuesday', emoji: '🔔' },
];
function categoryMeta(key) { return CATEGORIES.find(c => c.key === key) || CATEGORIES[0]; }

const EMOJI_CHOICES = ['⭐', '❤️', '🗓️', '🧭', '🔔', '🎮', '⚽', '🎵', '✈️', '📚', '☕', '🎨', '🎸', '🥾', '💼'];
const PERSON_EMOJIS = ['🧑', '🧑‍🦱', '🧑‍🦰', '🧑‍🦳', '🧕', '🧔', '👩‍🦱', '👨‍🦲', '🧑‍🎓', '👩‍🦰'];

const PRESETS = [
  { key: 'becomeCloser', category: 'relationship', label: 'Become closer friends', emoji: '🤗', hint: 'Feel more like close friends day-to-day', suggestion: 'Small, low-pressure hangouts often build closeness faster than big conversations.' },
  { key: 'deeper', category: 'relationship', label: 'Have deeper conversations', emoji: '💬', hint: 'Have 3 meaningful conversations', suggestion: 'Try sharing something a little more personal before asking a personal question back.' },
  { key: 'learn', category: 'relationship', label: 'Learn more about them', emoji: '🔍', hint: 'Learn 5 new things about them', suggestion: 'Ask about something they mentioned in passing last time you spoke.' },
  { key: 'shared', category: 'relationship', label: 'Find shared interests', emoji: '🧩', hint: 'Discover 3 shared interests', suggestion: 'Bring up a few of your own interests and see what lands.' },
  { key: 'together', category: 'relationship', label: 'Spend more time together', emoji: '🤝', hint: 'Plan 2 shared activities', suggestion: 'Suggest something specific rather than a vague "we should hang out".' },
  { key: 'maintain', category: 'relationship', label: 'Maintain the friendship', emoji: '🌱', hint: 'Check in at least once every 2 weeks', suggestion: 'A quick, low-effort message still counts.' },
  { key: 'comfortable1on1', category: 'relationship', label: 'Become more comfortable talking 1-on-1', emoji: '🎯', hint: 'Have one relaxed one-on-one conversation', suggestion: 'A low-pressure setting, like walking or an activity, can make this easier.' },
  { key: 'followUpQ', category: 'skill', label: 'Ask better follow-up questions', emoji: '❓', hint: 'Practise in your next 3 conversations', suggestion: 'When they mention something, pick one detail and ask about that specifically.' },
  { key: 'fewerQuestions', category: 'skill', label: 'Stop asking too many questions', emoji: '⏸️', hint: 'Balance questions with sharing in your next 3 chats', suggestion: 'After asking a question, try sharing something related before asking another.' },
  { key: 'selfDisclosureGoal', category: 'skill', label: 'Share more about myself', emoji: '💫', hint: 'Open up about something personal', suggestion: 'When they share something, follow up with a related story of your own.' },
  { key: 'activeListeningGoal', category: 'skill', label: 'Improve active listening', emoji: '👂', hint: 'Use better follow-ups in 5 conversations', suggestion: 'Try paraphrasing what they said before responding.' },
  { key: 'readCues', category: 'skill', label: 'Notice conversational cues', emoji: '👀', hint: 'Practise reading energy in your next 5 chats', suggestion: 'Pay attention to response length and timing, not just the words.' },
  { key: 'reciprocal', category: 'skill', label: 'Practise reciprocal self-disclosure', emoji: '🔄', hint: 'Match their openness in your next 3 conversations', suggestion: 'If they share something personal, share something of similar depth back.' },
  { key: 'recognizeSpace', category: 'skill', label: 'Recognise when someone wants space', emoji: '🌤️', hint: 'Notice and respect signs in your next 5 conversations', suggestion: 'Short replies and slower responses are often a sign to ease off.' },
  { key: 'custom', category: 'custom', label: 'Custom goal', emoji: '✏️', hint: '', suggestion: 'Check back in on this goal after your next few conversations.' },
];
function presetMeta(key) { return PRESETS.find(p => p.key === key); }

const TYPE_META = {
  talked: { emoji: '💬', label: 'Talked', verbHigh: 'Had a meaningful conversation', verbLow: 'Talked for a bit' },
  activity: { emoji: '🎮', label: 'Did an activity', verbHigh: 'Had a great time doing an activity together', verbLow: 'Did an activity together' },
  messaged: { emoji: '📱', label: 'Messaged', verbHigh: 'Had a good exchange of messages', verbLow: 'Exchanged messages' },
  hangout: { emoji: '🍕', label: 'Hung out', verbHigh: 'Had a really good hangout', verbLow: 'Hung out together' },
  called: { emoji: '📞', label: 'Called', verbHigh: 'Had a meaningful call', verbLow: 'Had a call' },
  other: { emoji: '✏️', label: 'Other', verbHigh: 'Logged a meaningful interaction', verbLow: 'Logged an interaction' },
  analysed: { emoji: '📸', label: 'Analysed', verbHigh: 'Had an engaged conversation', verbLow: 'Reviewed a conversation' },
};
const TYPE_ORDER = ['talked', 'activity', 'messaged', 'hangout', 'called', 'other'];

const AL_ITEMS = [
  { key: 'followup', label: 'Asked follow-up questions' },
  { key: 'paraphrase', label: 'Paraphrased or clarified' },
  { key: 'listened', label: 'Let them speak without interrupting' },
  { key: 'remembered', label: 'Remembered something they previously mentioned' },
];

const CONV_STATES = {
  engaged: { emoji: '🟢', label: 'Engaged', desc: 'They are contributing, asking questions and introducing topics.' },
  lowEnergy: { emoji: '🟡', label: 'Low energy but engaged', desc: 'Shorter responses, but they continue participating.' },
  listening: { emoji: '🟡', label: 'Listening mode', desc: "They seem happy to hear your stories but aren't introducing many topics." },
  unclear: { emoji: '🟠', label: 'Unclear', desc: 'Not enough evidence to tell yet.' },
  windingDown: { emoji: '🔴', label: 'Likely wants to finish', desc: 'Repeated short responses or signs they may be tired or busy.' },
};

const ACHIEVEMENTS = [
  { key: 'firstMeaningful', emoji: '🏅', title: 'First Meaningful Conversation', desc: 'Log a conversation rated Personal or Deep.' },
  { key: 'activeListener', emoji: '🎧', title: 'Active Listener', desc: 'Practise active listening in 5 or more conversations.' },
  { key: 'remembered10', emoji: '🧠', title: 'Remembered 10 Things', desc: 'Save 10 pieces of information across your relationships.' },
  { key: 'reciprocityMaster', emoji: '🔄', title: 'Master of Reciprocity', desc: 'Reach 75% in your reciprocity skill.' },
  { key: 'relationshipBuilder', emoji: '🌱', title: 'Relationship Builder', desc: 'Grow two relationships into the Personal layer or closer.' },
];

/* ============================== HELPERS ============================== */

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
let uidCounter = 0;
function uid() { uidCounter += 1; return `id-${Date.now().toString(36)}-${uidCounter}`; }

function parseDaysAgo(str) {
  if (!str) return 999;
  const s = String(str).toLowerCase();
  if (s.includes('just now') || s === 'today') return 0;
  if (s === 'yesterday') return 1;
  let m = s.match(/(\d+)\s*day/); if (m) return parseInt(m[1], 10);
  m = s.match(/(\d+)\s*week/); if (m) return parseInt(m[1], 10) * 7;
  m = s.match(/(\d+)\s*month/); if (m) return parseInt(m[1], 10) * 30;
  return 999;
}

function summaryFor(entry) {
  if (entry.summary) return entry.summary;
  const meta = TYPE_META[entry.type] || TYPE_META.other;
  return entry.meaningfulness >= 4 ? meta.verbHigh : meta.verbLow;
}

function updateStatusText(status) {
  if (!status) return 'Check whether a newer version is available.';
  switch (status.state) {
    case 'checking': return 'Checking for updates...';
    case 'up-to-date': return "You're on the latest version.";
    case 'available': return `Update v${status.version} found. Downloading...`;
    case 'downloading': return `Downloading update... ${status.percent || 0}%`;
    case 'ready': return `Update v${status.version} downloaded and ready to install.`;
    case 'not-configured': return "Update checking isn't set up for this build yet.";
    case 'error': return `Couldn't check for updates${status.message ? ` (${status.message})` : ''}.`;
    default: return 'Check whether a newer version is available.';
  }
}

function homeGoalTitle(goal, name) {
  if (goal.category === 'relationship' && name) {
    switch (goal.type) {
      case 'learn': return `Learn more about ${name}`;
      case 'shared': return `Find common ground with ${name}`;
      case 'together': return `Spend more time with ${name}`;
      case 'maintain': return `Stay close with ${name}`;
      case 'comfortable1on1': return `Feel more at ease one-on-one with ${name}`;
      case 'deeper': return `Have deeper talks with ${name}`;
      default: return `Get closer to ${name}`;
    }
  }
  return goal.title;
}

function generateSuggestions(person) {
  const candidates = [];
  person.plans.filter(i => !i.archived).forEach(it => { const d = parseDaysAgo(it.updated); if (d >= 3) candidates.push({ d, headline: `You haven't asked about "${it.text}" in a while.`, body: "You could ask what's new with it, or how they're feeling about it." }); });
  person.important.filter(i => !i.archived).forEach(it => { const d = parseDaysAgo(it.updated); if (d >= 3) candidates.push({ d, headline: `${person.name} mentioned "${it.text}" a little while ago.`, body: 'It might be worth asking how that went.' }); });
  person.experiences.filter(i => !i.archived).forEach(it => { const d = parseDaysAgo(it.updated); if (d >= 7) candidates.push({ d, headline: `${person.name} once told you about "${it.text}".`, body: 'You could bring it up if it feels natural.' }); });
  person.interests.filter(i => !i.archived).forEach(it => { const d = parseDaysAgo(it.updated); if (d >= 7) candidates.push({ d, headline: `${person.name} is into ${it.text}.`, body: 'Ask what got them into it, or bring it up next time you talk.' }); });
  candidates.sort((a, b) => b.d - a.d);
  return candidates.slice(0, 2);
}

/* ============================== MOCK SCREENSHOT-ANALYSIS SCENARIOS ============================== */

const SCENARIOS = {
  a: {
    key: 'a', title: 'A great catch-up', preview: '"yes omg the last lap was insane"',
    transcript: [
      { who: 'them', text: "hey! how's it going" },
      { who: 'you', text: 'good! just watched the F1 race, did you catch it?' },
      { who: 'them', text: 'yes omg the last lap was insane' },
      { who: 'you', text: "I know, I was literally yelling at my screen. who do you support?" },
      { who: 'them', text: 'Verstappen all the way. you?' },
      { who: 'you', text: 'Norris for me, I like an underdog. are you going to any races this year?' },
      { who: 'them', text: 'thinking about it! would be amazing to go to Silverstone' },
    ],
    conversationState: 'engaged',
    grading: { overall: 84, depth: 72, activeListening: 88, reciprocity: 82, naturalness: 86, goalImpact: 9 },
    wentWell: ['You followed up on something they mentioned.', 'You shared your own related experience.', 'You asked a relevant, open-ended question.'],
    opportunity: 'You could ask a bit more about what draws them to their favourite driver specifically.',
    tryNextTime: "When someone shares an opinion you don't fully share, it's a great moment to explore why rather than just moving on.",
    emotionalCues: [{ emoji: '😊', text: 'They used "omg" and short excited phrases. They seem genuinely excited about the race.' }],
    encourager: { type: 'good', line: '"Really? What happened?" after they shared a story.', why: 'It came right after they offered something, and invited more detail.' },
    extractedInfo: [
      { category: 'interests', text: 'Supports a specific F1 driver', temporary: false },
      { category: 'plans', text: 'Thinking about going to Silverstone', temporary: false },
    ],
    next: {
      continueTopic: { text: 'Ask what it would take for them to actually book Silverstone tickets.', natural: 'Silverstone would be unreal, you should look into ticket prices!', playful: "okay but if you go to Silverstone you HAVE to send me videos", deeper: "That's such a cool goal! What got you into F1 in the first place?" },
      shareYourself: { text: "Tell them about a race or sports event you've been to, or want to go to." },
      changeTopic: { text: "Ask what else they've been up to this week." },
      dontMessage: null,
    },
  },
  b: {
    key: 'b', title: 'A winding-down chat', preview: '"ok i guess"',
    transcript: [
      { who: 'them', text: 'hey' },
      { who: 'you', text: 'hey! how was your exam today?' },
      { who: 'them', text: 'ok i guess' },
      { who: 'you', text: "that's good, what subject was it again?" },
      { who: 'them', text: 'maths' },
      { who: 'you', text: 'nice, do you think you did well?' },
      { who: 'them', text: 'not really sure. pretty tired now' },
    ],
    conversationState: 'windingDown',
    grading: { overall: 58, depth: 40, activeListening: 70, reciprocity: 38, naturalness: 64, goalImpact: 2 },
    wentWell: ['You checked in about something they mentioned before (the exam).'],
    opportunity: 'Several questions were asked in a row without much space for them to share more, and their answers stayed short.',
    tryNextTime: 'When responses get shorter, it can help to share a small thought of your own or offer a natural close rather than another question.',
    emotionalCues: [{ emoji: '😴', text: 'They mentioned being tired and gave short replies. They may be low-energy right now.' }],
    encourager: { type: 'poor', line: '"Really?" repeated after short answers, without adding anything.', why: "It didn't build on what they said, so it read as a filler rather than genuine interest." },
    extractedInfo: [{ category: 'important', text: 'Had a maths exam today', temporary: true }],
    recommendation: 'A natural ending may be better than another question right now.',
    next: {
      continueTopic: null,
      shareYourself: null,
      changeTopic: null,
      dontMessage: { text: 'The conversation appears to have wound down naturally. It may be fine to leave it here for now.' },
    },
  },
  c: {
    key: 'c', title: 'A first proper conversation', preview: '"wait you skate too?"',
    transcript: [
      { who: 'them', text: 'wait you skate too?' },
      { who: 'you', text: "yeah since I was like 12, why?" },
      { who: 'them', text: "no way, I just started a few months ago, still terrible lol" },
      { who: 'you', text: "everyone's terrible at first honestly, what board are you on?" },
      { who: 'them', text: "just a cheap one from the sports shop, didn't want to spend much before I knew if I'd stick with it" },
      { who: 'you', text: 'smart. there\'s a decent spot near the river if you ever want to go sometime' },
      { who: 'them', text: "oh for sure, that'd be fun" },
    ],
    conversationState: 'engaged',
    grading: { overall: 76, depth: 45, activeListening: 80, reciprocity: 74, naturalness: 82, goalImpact: 11 },
    wentWell: ['You found a genuine shared interest.', 'You matched their energy without overwhelming them.', 'You suggested a specific, low-pressure next step.'],
    opportunity: "This stayed fairly surface-level, which is completely normal this early. There wasn't really an opening to go deeper yet.",
    tryNextTime: "Early on, shared activities like this are often more valuable than trying to force a deeper conversation. You're already doing that well.",
    emotionalCues: [{ emoji: '😊', text: 'They used "lol" and poked fun at themselves. A relaxed, easy sign this early on.' }],
    encourager: { type: 'good', line: '"everyone\'s terrible at first honestly" right after they downplayed their skill.', why: 'It reassured them without dismissing what they said, and kept the conversation moving.' },
    extractedInfo: [{ category: 'interests', text: 'Skateboarding (just started)', temporary: false }],
    next: {
      continueTopic: { text: 'Ask what got them into skating.', natural: 'What made you want to pick it up?', playful: 'okay but real talk, worst wipeout so far?', deeper: 'Would you want to learn together sometime, or do you already have people you go with?' },
      shareYourself: { text: 'Tell them about your own first few months learning.' },
      changeTopic: null,
      dontMessage: null,
    },
  },
  d: {
    key: 'd', title: 'A vulnerable, close conversation', preview: '"can I tell you something..."',
    transcript: [
      { who: 'them', text: "can I tell you something I haven't told many people" },
      { who: 'you', text: "of course, I'm here" },
      { who: 'them', text: "I've been really struggling with my confidence since I changed jobs. I keep feeling like I don't belong there" },
      { who: 'you', text: "that sounds exhausting to carry around every day. I felt something similar when I started here, it took me a while to feel like I wasn't faking it" },
      { who: 'them', text: 'really? you always seem so sure of yourself' },
      { who: 'you', text: "definitely not on the inside for the first few months. what's been the hardest part for you?" },
      { who: 'them', text: 'just the constant second-guessing, I think. it helps to say it out loud though' },
    ],
    conversationState: 'engaged',
    grading: { overall: 91, depth: 94, activeListening: 92, reciprocity: 90, naturalness: 88, goalImpact: 14 },
    wentWell: ['You made space for them to open up without rushing them.', 'You shared something genuinely personal in return, not just reassurance.', 'You asked a follow-up that invited more, rather than trying to fix it.'],
    opportunity: "There's not much to improve here. If anything, resist the urge to jump straight to advice next time this happens.",
    tryNextTime: "Conversations like this land well specifically because you didn't try to solve it. Keep noticing that instinct.",
    emotionalCues: [{ emoji: '😟', text: 'They described ongoing self-doubt with words like "struggling" and "constant". This seems to be weighing on them.' }],
    encourager: { type: 'good', line: '"that sounds exhausting to carry around every day" right after they shared something hard.', why: 'It reflected what they said back to them before adding anything of your own, a strong active-listening move.' },
    extractedInfo: [{ category: 'important', text: 'Has been struggling with confidence since changing jobs', temporary: false }],
    next: {
      continueTopic: null,
      shareYourself: null,
      changeTopic: null,
      dontMessage: { text: 'This felt like a complete, meaningful moment. Let it sit rather than following up with something lighter right away.' },
    },
  },
};

/* ============================== SEED DATA ============================== */

const INITIAL_PEOPLE = [
  {
    id: 'alex', name: 'Alex', emoji: '🧑', layer: 3,
    dims: { depth: 70, trust: 72, reciprocity: 78, interaction: 84, sharedExperiences: 61, listening: 86 }, overall: 72,
    interests: [
      { id: 'alex-int-1', emoji: '🏎️', text: 'Formula 1', updated: 'Today', temporary: false, archived: false },
      { id: 'alex-int-2', emoji: '🎮', text: 'Xbox', updated: '9 days ago', temporary: false, archived: false },
      { id: 'alex-int-3', emoji: '⚽', text: 'Football', updated: '15 days ago', temporary: false, archived: false },
    ],
    preferences: [
      { id: 'alex-pref-1', emoji: '🍕', text: 'Likes pizza', updated: '4 days ago', temporary: false, archived: false },
    ],
    plans: [
      { id: 'alex-plan-1', emoji: '✈️', text: 'Wants to travel to Japan', updated: '6 days ago', temporary: false, archived: false },
      { id: 'alex-plan-2', emoji: '🗓️', text: 'Thinking about going to Silverstone', updated: '2 days ago', temporary: false, archived: false },
    ],
    experiences: [
      { id: 'alex-exp-1', emoji: '🏫', text: 'Changed schools last year', updated: '3 weeks ago', temporary: false, archived: false },
    ],
    important: [
      { id: 'alex-imp-1', emoji: '📚', text: 'Maths test next week', updated: '1 day ago', temporary: true, archived: false },
    ],
    goals: [
      { id: 'alex-goal-1', personId: 'alex', category: 'relationship', type: 'becomeCloser', title: 'Become closer friends', description: 'Have deeper conversations', progress: 72, history: [{ date: 'Aug 20', value: 42 }, { date: 'Aug 28', value: 60 }, { date: 'Sep 3', value: 72 }] },
      { id: 'alex-goal-2', personId: 'alex', category: 'relationship', type: 'learn', title: 'Learn more about them', description: 'Learn 5 new things about them', progress: 80, history: [{ date: 'Aug 20', value: 55 }, { date: 'Sep 3', value: 80 }] },
      { id: 'alex-goal-3', personId: 'alex', category: 'relationship', type: 'together', title: 'Spend more time together', description: 'Plan one shared activity outside school', progress: 40, history: [{ date: 'Aug 20', value: 20 }, { date: 'Sep 3', value: 40 }] },
    ],
    history: [{ date: 'Aug 20', value: 42 }, { date: 'Aug 24', value: 51 }, { date: 'Aug 28', value: 63 }, { date: 'Sep 3', value: 72 }],
    timeline: [
      { label: 'First met', date: '2 months ago' },
      { label: 'First proper conversation', date: '7 weeks ago' },
      { label: 'Shared interest discovered', date: '5 weeks ago' },
      { label: 'First personal conversation', date: '2 weeks ago' },
    ],
  },
  {
    id: 'jamie', name: 'Jamie', emoji: '🧑‍🦱', layer: 2,
    dims: { depth: 45, trust: 48, reciprocity: 52, interaction: 55, sharedExperiences: 40, listening: 58 }, overall: 49,
    interests: [
      { id: 'jamie-int-1', emoji: '🎌', text: 'Anime', updated: '3 days ago', temporary: false, archived: false },
      { id: 'jamie-int-2', emoji: '🎲', text: 'Board games', updated: '9 days ago', temporary: false, archived: false },
    ],
    preferences: [
      { id: 'jamie-pref-1', emoji: '☕', text: 'Prefers coffee catch-ups', updated: '5 days ago', temporary: false, archived: false },
    ],
    plans: [
      { id: 'jamie-plan-1', emoji: '🗓️', text: 'Studying for exams this month', updated: '2 days ago', temporary: false, archived: false },
    ],
    experiences: [],
    important: [
      { id: 'jamie-imp-1', emoji: '📚', text: 'Had a maths exam today', updated: 'Today', temporary: true, archived: false },
    ],
    goals: [
      { id: 'jamie-goal-1', personId: 'jamie', category: 'relationship', type: 'learn', title: 'Learn more about them', description: 'Discover 3 shared interests', progress: 50, history: [{ date: 'Aug 22', value: 30 }, { date: 'Sep 1', value: 50 }] },
      { id: 'jamie-goal-2', personId: 'jamie', category: 'relationship', type: 'deeper', title: 'Have deeper conversations', description: 'Have 2 meaningful conversations', progress: 30, history: [{ date: 'Aug 22', value: 15 }, { date: 'Sep 1', value: 30 }] },
    ],
    history: [{ date: 'Aug 22', value: 30 }, { date: 'Aug 27', value: 40 }, { date: 'Sep 1', value: 50 }],
    timeline: [
      { label: 'First met', date: '3 weeks ago' },
      { label: 'First proper conversation', date: '2 weeks ago' },
      { label: 'Shared interest discovered', date: '9 days ago' },
    ],
  },
  {
    id: 'priya', name: 'Priya', emoji: '🧕', layer: 4,
    dims: { depth: 85, trust: 92, reciprocity: 88, interaction: 85, sharedExperiences: 82, listening: 90 }, overall: 87,
    interests: [
      { id: 'priya-int-1', emoji: '🥾', text: 'Hiking', updated: '5 days ago', temporary: false, archived: false },
      { id: 'priya-int-2', emoji: '📷', text: 'Photography', updated: '12 days ago', temporary: false, archived: false },
    ],
    preferences: [
      { id: 'priya-pref-1', emoji: '❤️', text: 'Vegetarian', updated: '10 days ago', temporary: false, archived: false },
    ],
    plans: [
      { id: 'priya-plan-1', emoji: '🗓️', text: 'Planning a trip to Italy', updated: '8 days ago', temporary: false, archived: false },
    ],
    experiences: [
      { id: 'priya-exp-1', emoji: '🧭', text: 'Moved cities two years ago', updated: '2 months ago', temporary: false, archived: false },
    ],
    important: [
      { id: 'priya-imp-1', emoji: '💼', text: 'New job starts this month', updated: '4 days ago', temporary: true, archived: false },
    ],
    goals: [
      { id: 'priya-goal-1', personId: 'priya', category: 'relationship', type: 'maintain', title: 'Maintain the friendship', description: 'Check in at least once every 2 weeks', progress: 90, history: [{ date: 'Aug 15', value: 78 }, { date: 'Sep 3', value: 90 }] },
      { id: 'priya-goal-2', personId: 'priya', category: 'skill', type: 'selfDisclosureGoal', title: 'Share more about myself', description: 'Open up about something personal', progress: 70, history: [{ date: 'Aug 15', value: 50 }, { date: 'Sep 3', value: 70 }] },
    ],
    history: [{ date: 'Aug 15', value: 75 }, { date: 'Aug 22', value: 80 }, { date: 'Aug 29', value: 85 }, { date: 'Sep 3', value: 87 }],
    timeline: [
      { label: 'First met', date: '6 months ago' },
      { label: 'First proper conversation', date: '5 months ago' },
      { label: 'Shared interest discovered', date: '4 months ago' },
      { label: 'First personal conversation', date: '3 months ago' },
    ],
  },
  {
    id: 'noah', name: 'Noah', emoji: '🧑‍🎓', layer: 2,
    dims: { depth: 38, trust: 35, reciprocity: 42, interaction: 48, sharedExperiences: 35, listening: 44 }, overall: 40,
    interests: [
      { id: 'noah-int-1', emoji: '🎸', text: 'Guitar', updated: '4 days ago', temporary: false, archived: false },
    ],
    preferences: [],
    plans: [],
    experiences: [],
    important: [
      { id: 'noah-imp-1', emoji: '💼', text: 'Starting a new job', updated: '2 days ago', temporary: true, archived: false },
    ],
    goals: [
      { id: 'noah-goal-1', personId: 'noah', category: 'relationship', type: 'shared', title: 'Find shared interests', description: 'Discover 2 shared interests', progress: 40, history: [{ date: 'Aug 25', value: 20 }, { date: 'Sep 2', value: 40 }] },
    ],
    history: [{ date: 'Aug 25', value: 28 }, { date: 'Aug 30', value: 34 }, { date: 'Sep 2', value: 40 }],
    timeline: [{ label: 'First met', date: '1 month ago' }],
  },
  {
    id: 'sam', name: 'Sam', emoji: '🧑‍🦳', layer: 1,
    dims: { depth: 15, trust: 18, reciprocity: 20, interaction: 22, sharedExperiences: 12, listening: 22 }, overall: 18,
    interests: [
      { id: 'sam-int-1', emoji: '🧗', text: 'Rock climbing', updated: '2 weeks ago', temporary: false, archived: false },
    ],
    preferences: [],
    plans: [],
    experiences: [],
    important: [],
    goals: [
      { id: 'sam-goal-1', personId: 'sam', category: 'relationship', type: 'deeper', title: 'Have deeper conversations', description: 'Have 2 meaningful conversations', progress: 15, history: [{ date: 'Aug 27', value: 8 }, { date: 'Sep 3', value: 15 }] },
    ],
    history: [{ date: 'Aug 27', value: 10 }, { date: 'Sep 1', value: 15 }, { date: 'Sep 3', value: 18 }],
    timeline: [{ label: 'First met', date: '2 weeks ago' }],
  },
];

const INITIAL_GENERAL_GOALS = [
  { id: 'gen-goal-1', personId: null, category: 'skill', type: 'activeListeningGoal', title: 'Improve active listening', description: 'Use better follow-ups in 5 conversations', progress: 64, history: [{ date: 'Aug 20', value: 40 }, { date: 'Aug 28', value: 52 }, { date: 'Sep 3', value: 64 }] },
];

const INITIAL_JOURNAL = [
  { id: 'j1', personId: 'alex', date: 'Today', isThisWeek: true, type: 'talked', meaningfulness: 4, added: ['Interested in F1'], activeListening: ['followup', 'remembered'], summary: 'Had a meaningful conversation' },
  { id: 'j2', personId: 'jamie', date: 'Yesterday', isThisWeek: true, type: 'activity', meaningfulness: 3, added: [], activeListening: [], summary: 'Played Xbox together' },
  { id: 'j3', personId: 'alex', date: 'Aug 31', isThisWeek: true, type: 'talked', meaningfulness: 3, added: [], activeListening: ['listened'], summary: 'Talked about future plans' },
  { id: 'j4', personId: 'priya', date: 'Aug 30', isThisWeek: true, type: 'talked', meaningfulness: 5, added: ['Moved cities two years ago'], activeListening: ['paraphrase', 'followup'] },
  { id: 'j5', personId: 'noah', date: 'Aug 29', isThisWeek: true, type: 'hangout', meaningfulness: 3, added: [], activeListening: [] },
  { id: 'j6', personId: 'sam', date: 'Aug 28', isThisWeek: true, type: 'messaged', meaningfulness: 2, added: [], activeListening: [] },
  { id: 'j7', personId: 'jamie', date: 'Aug 27', isThisWeek: true, type: 'called', meaningfulness: 3, added: [], activeListening: ['remembered'] },
];

const INITIAL_SKILLS = {
  activeListening: { label: 'Active listening', current: 82, history: [{ date: 'Sep', value: 64 }, { date: 'Oct', value: 70 }, { date: 'Nov', value: 75 }, { date: 'Dec', value: 79 }, { date: 'Jan', value: 82 }] },
  followUp: { label: 'Follow-up questions', current: 74, history: [{ date: 'Sep', value: 58 }, { date: 'Oct', value: 63 }, { date: 'Nov', value: 68 }, { date: 'Dec', value: 71 }, { date: 'Jan', value: 74 }] },
  reciprocity: { label: 'Reciprocity', current: 69, history: [{ date: 'Sep', value: 52 }, { date: 'Oct', value: 58 }, { date: 'Nov', value: 62 }, { date: 'Dec', value: 66 }, { date: 'Jan', value: 69 }] },
  selfDisclosure: { label: 'Self-disclosure', current: 61, history: [{ date: 'Sep', value: 48 }, { date: 'Oct', value: 52 }, { date: 'Nov', value: 55 }, { date: 'Dec', value: 58 }, { date: 'Jan', value: 61 }] },
  readingCues: { label: 'Reading conversational cues', current: 68, history: [{ date: 'Sep', value: 53 }, { date: 'Oct', value: 58 }, { date: 'Nov', value: 62 }, { date: 'Dec', value: 65 }, { date: 'Jan', value: 68 }] },
  knowingWhenToStop: { label: 'Knowing when to stop', current: 77, history: [{ date: 'Sep', value: 60 }, { date: 'Oct', value: 66 }, { date: 'Nov', value: 71 }, { date: 'Dec', value: 74 }, { date: 'Jan', value: 77 }] },
};
const SKILL_ORDER = ['activeListening', 'followUp', 'reciprocity', 'selfDisclosure', 'readingCues', 'knowingWhenToStop'];
const FOCUS_SKILL_KEY = 'reciprocity';
const FOCUS_TEXT = 'You ask strong follow-up questions, but you sometimes ask another question when you could share your own experience.';
const CHALLENGE_TEXT = 'In your next 3 conversations, when someone says something you can relate to, share your own experience before asking another question.';

const EMPTY_SKILLS = {
  activeListening: { label: 'Active listening', current: 0, history: [] },
  followUp: { label: 'Follow-up questions', current: 0, history: [] },
  reciprocity: { label: 'Reciprocity', current: 0, history: [] },
  selfDisclosure: { label: 'Self-disclosure', current: 0, history: [] },
  readingCues: { label: 'Reading conversational cues', current: 0, history: [] },
  knowingWhenToStop: { label: 'Knowing when to stop', current: 0, history: [] },
};

const FOCUS_OPTIONS = [
  { key: 'new', label: 'Building new friendships' },
  { key: 'deepen', label: 'Deepening close relationships' },
  { key: 'skills', label: 'My own social skills' },
  { key: 'mix', label: 'A bit of everything' },
];
const FOCUS_LABELS = { new: 'building new friendships', deepen: 'deepening close relationships', skills: 'your own social skills', mix: 'a bit of everything' };

/* ============================== LOCAL PERSISTENCE ============================== */

const STORAGE_KEY = 'layers-app-state-v1';

function loadSaved() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function persistState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Storage unavailable (private browsing, disabled storage, etc). Fail silently.
  }
}

const LAST_NOTIFIED_KEY = 'layers-last-notified-date';
function getLastNotifiedDate() {
  try { return window.localStorage.getItem(LAST_NOTIFIED_KEY); } catch (e) { return null; }
}
function setLastNotifiedDate(d) {
  try { window.localStorage.setItem(LAST_NOTIFIED_KEY, d); } catch (e) { /* ignore */ }
}

function getCheckInSuggestions(people, journal) {
  const lastSeen = {};
  journal.forEach(j => {
    const d = parseDaysAgo(j.date);
    if (lastSeen[j.personId] === undefined || d < lastSeen[j.personId]) lastSeen[j.personId] = d;
  });
  return people.filter(p => lastSeen[p.id] !== undefined && lastSeen[p.id] >= 14).map(p => p.name);
}

/* ============================== CSS ============================== */

function cssVarBlock(theme) {
  return Object.entries(theme).map(([k, v]) => `--c-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v};`).join('\n  ');
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap');

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
.font-display { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-weight: 500; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
button { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; cursor: pointer; background: none; border: none; padding: 0; }
input, textarea { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; }

.layers-root {
  ${cssVarBlock(THEME_LIGHT)}
  transition: background-color .25s ease;
}
.layers-root.dark {
  ${cssVarBlock(THEME_DARK)}
}

.phone-frame {
  width: 100%; max-width: 428px; margin: 0 auto;
  background: ${COLORS.paper}; position: relative; overflow: hidden;
  border-radius: 0px; box-shadow: 0 0 0 1px ${COLORS.line};
  height: 100vh; display: flex; flex-direction: column;
  font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
  transition: background-color .25s ease;
}
@media (min-width: 480px) {
  .phone-frame { height: 860px; max-height: 92vh; margin-top: 20px; margin-bottom: 20px; border-radius: 40px; box-shadow: 0 0 0 1px ${COLORS.line}, 0 24px 60px rgba(35,40,58,0.16); }
}
.scroll-area { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

.nav-bar { display: flex; align-items: center; justify-content: space-around; padding: 8px 4px 12px; border-top: 1px solid ${COLORS.line}; background: ${COLORS.paperRaised}; position: relative; z-index: 10; }
.nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 8px; border-radius: 14px; font-size: 10.5px; }

.fab-btn { position: absolute; right: 18px; bottom: 80px; width: 54px; height: 54px; border-radius: 50%; background: ${COLORS.accent}; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 24px rgba(51,80,107,0.4); z-index: 20; transition: transform .15s ease; }
.fab-btn:active { transform: scale(0.92); }

.sheet { position: absolute; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
.sheet-overlay { position: absolute; inset: 0; background: rgba(35,40,58,0.45); }
.sheet-panel { position: relative; width: 100%; max-height: 88%; display: flex; flex-direction: column; background: ${COLORS.paperRaised}; border-radius: 26px 26px 0 0; box-shadow: 0 -12px 36px rgba(35,40,58,0.2); overflow: hidden; }
.sheet-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 4px 20px 10px; }

@keyframes sheetUp { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.sheet-anim { animation: sheetUp .3s cubic-bezier(0.22,1,0.36,1); }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fade-anim { animation: fadeIn .25s ease-out; }
@keyframes toastIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.toast-stack { position: absolute; left: 0; right: 0; bottom: 92px; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 70; pointer-events: none; padding: 0 20px; }
.toast { background: ${COLORS.ink}; color: #fff; padding: 10px 16px; border-radius: 999px; font-size: 13px; box-shadow: 0 8px 20px rgba(0,0,0,0.25); text-align: center; animation: toastIn .25s ease-out; }

button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 2px; }
input[type="range"] { width: 100%; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

/* ============================== UI ATOMS ============================== */

function CircularProgress({ percent, size = 140, stroke = 12, color = COLORS.accent, track = COLORS.line, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamp(percent, 0, 100) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center px-2">
        <span className="font-display" style={{ fontSize: size * 0.24, color: COLORS.ink, lineHeight: 1 }}>{Math.round(percent)}%</span>
        {label && <span className="text-xs mt-1.5 text-center" style={{ color: COLORS.inkSoft, maxWidth: size * 0.75 }}>{label}</span>}
      </div>
    </div>
  );
}

function ProgressBar({ percent, color = COLORS.accent, height = 8, track = COLORS.line }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: track }}>
      <div className="h-full rounded-full" style={{ width: `${clamp(percent, 0, 100)}%`, background: color, transition: 'width .8s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  );
}

function LabeledBar({ label, percent, color, size = 'sm' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={size === 'lg' ? 'text-sm font-medium' : 'text-xs font-medium'} style={{ color: COLORS.ink }}>{label}</span>
        <span className={size === 'lg' ? 'text-sm font-semibold' : 'text-xs font-semibold'} style={{ color }}>{Math.round(percent)}%</span>
      </div>
      <ProgressBar percent={percent} color={color} height={size === 'lg' ? 8 : 7} />
    </div>
  );
}

function Avatar({ emoji, size = 44, ringColor, bg = COLORS.paperRaised }) {
  return (
    <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: size, height: size, background: bg, border: `2px solid ${ringColor || COLORS.line}`, fontSize: size * 0.46 }}>
      {emoji}
    </div>
  );
}

function LayerBadge({ layerId }) {
  const l = getLayer(layerId);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: l.tint }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
      <span className="text-xs font-semibold" style={{ color: l.deep }}>Layer {l.id}: {l.name}</span>
    </span>
  );
}

function ChatBubble({ who, text }) {
  const isYou = who === 'you';
  return (
    <div className="flex mb-2" style={{ justifyContent: isYou ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%', background: isYou ? COLORS.accent : COLORS.paperRaised, color: isYou ? '#fff' : COLORS.ink, border: isYou ? 'none' : `1px solid ${COLORS.line}`, borderRadius: isYou ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '8px 12px' }}>
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}

function Timeline({ steps }) {
  return (
    <div>
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.current ? COLORS.accent : COLORS.paperRaised, border: `2px solid ${s.current ? COLORS.accent : COLORS.line}`, flexShrink: 0 }} />
            {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 22, background: COLORS.line }} />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium" style={{ color: s.current ? COLORS.accent : COLORS.ink }}>{s.label}</p>
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>{s.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConvStateBadge({ stateKey }) {
  const s = CONV_STATES[stateKey] || CONV_STATES.unclear;
  return (
    <div className="rounded-2xl p-3.5 flex items-start gap-2.5" style={{ background: COLORS.accentSoft }}>
      <span style={{ fontSize: 20 }}>{s.emoji}</span>
      <div>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{s.label}</p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{s.desc}</p>
      </div>
    </div>
  );
}

/* ============================== GOAL ROW / INFO ROW / NAV / SHEET ============================== */

function GoalRow({ goal, color, personName, onBump, onEdit, onDelete }) {
  const done = goal.progress >= 100;
  const preset = presetMeta(goal.type);
  return (
    <div className="rounded-2xl p-3 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, borderLeft: `4px solid ${color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{goal.title}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{goal.description}</p>
        </div>
        <span className="font-display shrink-0" style={{ fontSize: 18, color }}>{goal.progress}%</span>
      </div>
      <div className="mt-2"><ProgressBar percent={goal.progress} color={color} height={7} /></div>
      <div className="flex items-center gap-1 mt-1.5">
        {[25, 50, 75, 100].map(m => (<div key={m} style={{ flex: 1, height: 3, borderRadius: 2, background: goal.progress >= m ? color : COLORS.line }} />))}
      </div>
      {preset && preset.suggestion && (
        <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Next step: {preset.suggestion}</p>
      )}
      <div className="flex items-center gap-3 mt-2.5">
        {done ? (
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color }}><Check size={13} /> Completed</span>
        ) : (
          <button onClick={onBump} className="flex items-center gap-1 text-xs font-medium" style={{ color: COLORS.accent }}><TrendingUp size={13} /> Mark progress</button>
        )}
        <button onClick={onEdit} className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Pencil size={13} /> Edit</button>
        <button onClick={onDelete} className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Trash2 size={13} /> Delete</button>
      </div>
    </div>
  );
}

function InfoItemRow({ item, onSave, onDelete, onToggleTemporary, onToggleArchive }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  return (
    <div className="flex items-start justify-between gap-2 py-2.5" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <span style={{ fontSize: 16, lineHeight: '22px' }}>{item.emoji}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onSave(draft.trim()); setEditing(false); } if (e.key === 'Escape') { setDraft(item.text); setEditing(false); } }}
              className="w-full text-sm rounded-lg px-2 py-1" style={{ border: `1px solid ${COLORS.accent}`, color: COLORS.ink }} />
          ) : (
            <p className="text-sm" style={{ color: COLORS.ink }}>{item.text}{item.temporary && <span className="text-xs ml-1.5" style={{ color: COLORS.warn }}>(temporary)</span>}</p>
          )}
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Last mentioned: {item.updated}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        {editing ? (
          <button onClick={() => { if (draft.trim()) { onSave(draft.trim()); } setEditing(false); }} aria-label="Save" className="p-1"><Check size={14} color={COLORS.accent} /></button>
        ) : (
          <button onClick={() => setEditing(true)} aria-label={`Edit "${item.text}"`} className="p-1"><Pencil size={14} color={COLORS.inkSoft} /></button>
        )}
        <button onClick={onToggleTemporary} aria-pressed={item.temporary} aria-label={item.temporary ? 'Marked temporary, click to unmark' : 'Mark as temporary'} className="p-1"><Clock size={14} color={item.temporary ? COLORS.warn : COLORS.inkSoft} /></button>
        <button onClick={onToggleArchive} aria-label="Archive" className="p-1"><Archive size={14} color={COLORS.inkSoft} /></button>
        <button onClick={onDelete} aria-label={`Delete "${item.text}"`} className="p-1"><Trash2 size={14} color={COLORS.inkSoft} /></button>
      </div>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  const items = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'people', label: 'People', Icon: Users },
    { key: 'coach', label: 'Coach', Icon: MessageCircle },
    { key: 'journal', label: 'Journal', Icon: BookOpen },
    { key: 'me', label: 'Me', Icon: User },
  ];
  return (
    <div className="nav-bar">
      {items.map(it => {
        const isActive = active === it.key;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} className="nav-btn" style={{ color: isActive ? COLORS.accent : COLORS.inkSoft }}>
            <it.Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
            <span style={{ fontWeight: isActive ? 700 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Sheet({ title, onClose, children, footer }) {
  return (
    <div className="sheet">
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet-panel sheet-anim" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>{title}</p>
          <button onClick={onClose} aria-label="Close" className="p-1"><X size={20} color={COLORS.inkSoft} /></button>
        </div>
        <div className="sheet-body no-scrollbar">{children}</div>
        {footer && <div style={{ padding: '14px 20px 22px', borderTop: `1px solid ${COLORS.line}` }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ============================== HOME ============================== */

function HomeView({ people, journal, generalGoals, profile, onOpenPerson, onSwitchTab, onOpenGoals, onOpenCoach }) {
  const greeting = useMemo(() => { const h = new Date().getHours(); if (h < 12) return 'Good morning'; if (h < 18) return 'Good afternoon'; return 'Good evening'; }, []);
  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);

  const activeGoals = useMemo(() => people.flatMap(p => p.goals).concat(generalGoals).filter(g => g.progress < 100).length, [people, generalGoals]);
  const conversationsLogged = journal.length;
  const meaningfulInteractions = useMemo(() => journal.filter(j => j.meaningfulness >= 4).length, [journal]);
  const relationshipsInProgress = useMemo(() => {
    const s = new Set();
    people.forEach(p => { if (p.goals.some(g => g.progress < 100)) s.add(p.id); });
    journal.forEach(j => { if (j.isThisWeek) s.add(j.personId); });
    return s.size;
  }, [people, journal]);

  const topGoals = useMemo(() => {
    const fromPeople = people.flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ ...g, personName: p.name, color: getLayer(p.layer).color })));
    const fromGeneral = generalGoals.filter(g => g.progress < 100).map(g => ({ ...g, personName: null, color: COLORS.accent }));
    return [...fromPeople, ...fromGeneral].sort((a, b) => b.progress - a.progress).slice(0, 4);
  }, [people, generalGoals]);

  const recent = journal.slice(0, 3);

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{greeting}{profile && profile.name ? `, ${profile.name}` : ''} 👋</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{profile && profile.focus && FOCUS_LABELS[profile.focus] ? `Focusing on ${FOCUS_LABELS[profile.focus]}.` : 'Your social progress, at a glance.'}</p>

      <div className="grid grid-cols-2 gap-y-4 mt-6">
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{activeGoals}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>active goals</p>
        </div>
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{conversationsLogged}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>conversations logged</p>
        </div>
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{meaningfulInteractions}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>meaningful interactions</p>
        </div>
        <div>
          <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{relationshipsInProgress}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>being developed</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-7">
        <button onClick={() => onOpenCoach('prepare')} className="rounded-2xl p-3.5 text-left" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <p className="text-sm font-semibold mt-1.5" style={{ color: COLORS.ink }}>Prepare to talk</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Coach tips before a chat</p>
        </button>
        <button onClick={() => onOpenCoach('analyse')} className="rounded-2xl p-3.5 text-left" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <span style={{ fontSize: 20 }}>📸</span>
          <p className="text-sm font-semibold mt-1.5" style={{ color: COLORS.ink }}>Analyse a conversation</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Review a sample chat</p>
        </button>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between">
          <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>Current goals</p>
          <button onClick={onOpenGoals} className="text-xs font-medium" style={{ color: COLORS.accent }}>See all</button>
        </div>
        <div className="mt-3">
          {topGoals.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>No active goals yet. Set one to start tracking progress.</p>
          ) : topGoals.map(g => (
            <button key={g.id} onClick={() => g.personId ? onOpenPerson(g.personId) : onOpenGoals()} className="w-full text-left rounded-2xl p-3.5 mb-2.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{homeGoalTitle(g, g.personName)}</p>
                <span className="font-display shrink-0" style={{ fontSize: 19, color: g.color }}>{g.progress}%</span>
              </div>
              <div className="mt-2"><ProgressBar percent={g.progress} color={g.color} height={7} /></div>
              <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{g.description}</p>
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-7">
          <div className="flex items-center justify-between">
            <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>Recent activity</p>
            <button onClick={() => onSwitchTab('journal')} className="text-xs font-medium" style={{ color: COLORS.accent }}>View all</button>
          </div>
          <div className="mt-3">
            {recent.map(entry => {
              const p = peopleById[entry.personId];
              if (!p) return null;
              const l = getLayer(p.layer);
              return (
                <button key={entry.id} onClick={() => onOpenPerson(p.id)} className="w-full flex items-center gap-3 py-2.5 text-left" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: COLORS.ink }}><span className="font-semibold">{p.name}:</span> {summaryFor(entry)}</p>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: COLORS.inkSoft }}>{entry.date}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== PEOPLE ============================== */

function PeopleView({ people, journal, onOpenPerson, onAddPerson }) {
  const [view, setView] = useState('map');
  const [query, setQuery] = useState('');
  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter(p => p.name.toLowerCase().includes(q)) : people;
  }, [people, query]);
  const layersWithPeople = LAYERS.map(l => ({ ...l, people: filteredPeople.filter(p => p.layer === l.id) }));
  const radiusByLayer = { 4: 0.20, 3: 0.40, 2: 0.615, 1: 0.835 };
  const rotationOffset = { 1: 0, 2: 26, 3: 11, 4: 40 };
  const overviewData = useMemo(() => {
    const withTrend = filteredPeople.map(p => {
      let trend = 'flat';
      if (p.history.length >= 2) {
        const last = p.history[p.history.length - 1].value;
        const prev = p.history[p.history.length - 2].value;
        trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
      }
      return { ...p, trend };
    }).sort((a, b) => b.overall - a.overall);
    const avg = filteredPeople.length ? Math.round(filteredPeople.reduce((s, p) => s + p.overall, 0) / filteredPeople.length) : 0;
    const trendingUp = withTrend.filter(p => p.trend === 'up').length;
    const needsAttention = getCheckInSuggestions(filteredPeople, journal || []);
    return { ranked: withTrend, avg, trendingUp, needsAttention };
  }, [filteredPeople, journal]);

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Your circle</p>
          <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{people.length} relationships, at a glance</p>
        </div>
        <button onClick={onAddPerson} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
          <UserPlus size={14} /> Add
        </button>
      </div>

      {people.length === 0 ? (
        <div className="rounded-2xl p-5 mt-6 text-center" style={{ background: COLORS.paperRaised, border: `1px dashed ${COLORS.line}` }}>
          <span style={{ fontSize: 26 }}>🧭</span>
          <p className="text-sm font-semibold mt-2" style={{ color: COLORS.ink }}>Your circle is empty</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Add the first person you'd like to be more intentional about, and place them wherever your relationship is today.</p>
          <button onClick={onAddPerson} className="text-xs font-semibold rounded-full px-4 py-2 mt-3.5" style={{ background: COLORS.accent, color: '#fff' }}>Add your first person</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-4">
            <Search size={15} color={COLORS.inkSoft} className="shrink-0" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people..." aria-label="Search people" className="flex-1 text-sm rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.line}` }} />
          </div>
          <div className="flex items-center gap-2 mt-3">
            {['map', 'list', 'overview'].map(v => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="text-xs font-semibold rounded-full px-3 py-1.5 capitalize" style={{ background: view === v ? COLORS.accent : COLORS.paperRaised, color: view === v ? '#fff' : COLORS.inkSoft, border: `1px solid ${view === v ? COLORS.accent : COLORS.line}` }}>
                {v === 'map' ? 'Map view' : v === 'list' ? 'List view' : 'Overview'}
              </button>
            ))}
          </div>

          {filteredPeople.length === 0 ? (
            <p className="text-sm mt-6 text-center" style={{ color: COLORS.inkSoft }}>No one matches "{query}".</p>
          ) : view === 'map' ? (
            <>
              <div className="relative w-full mt-6" style={{ aspectRatio: '1 / 1' }}>
                <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
                  <circle cx="100" cy="100" r="95" fill={COLORS.layer1Tint} stroke={COLORS.layer1} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="72" fill={COLORS.layer2Tint} stroke={COLORS.layer2} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="50" fill={COLORS.layer3Tint} stroke={COLORS.layer3} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="28" fill={COLORS.layer4Tint} stroke={COLORS.layer4} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="15" fill={COLORS.accent} />
                  <text x="100" y="103.5" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700" fontFamily="Manrope, sans-serif">YOU</text>
                </svg>
                {layersWithPeople.flatMap(l => {
                  const n = l.people.length;
                  return l.people.map((p, i) => {
                    const angle = (360 / n) * i + (rotationOffset[l.id] || 0);
                    const rad = angle * Math.PI / 180;
                    const rPct = radiusByLayer[l.id] * 50;
                    const left = 50 + rPct * Math.cos(rad);
                    const top = 50 + rPct * Math.sin(rad);
                    return (
                      <button key={p.id} onClick={() => onOpenPerson(p.id)} className="absolute flex flex-col items-center gap-1" style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)' }}>
                        <Avatar emoji={p.emoji} size={40} ringColor={l.color} />
                        <span className="text-xs font-medium rounded-full px-1.5" style={{ color: COLORS.ink, background: 'rgba(255,255,255,0.85)' }}>{p.name}</span>
                      </button>
                    );
                  });
                })}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-5">
                {LAYERS.map(l => (
                  <div key={l.id} className="flex items-center gap-1.5">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                    <span className="text-xs" style={{ color: COLORS.inkSoft }}>{l.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : view === 'list' ? (
            <div className="mt-5">
              {filteredPeople.map(p => {
                const l = getLayer(p.layer);
                return (
                  <button key={p.id} onClick={() => onOpenPerson(p.id)} className="w-full flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <Avatar emoji={p.emoji} size={44} ringColor={l.color} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.name}</p>
                      <div className="mt-1"><LayerBadge layerId={p.layer} /></div>
                    </div>
                    <span className="font-display shrink-0" style={{ fontSize: 18, color: l.color }}>{p.overall}%</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5">
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div>
                  <p className="font-display" style={{ fontSize: 22, color: COLORS.ink }}>{overviewData.avg}%</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>average progress</p>
                </div>
                <div>
                  <p className="font-display" style={{ fontSize: 22, color: COLORS.good }}>{overviewData.trendingUp}</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>trending up</p>
                </div>
                <div>
                  <p className="font-display" style={{ fontSize: 22, color: COLORS.warn }}>{overviewData.needsAttention.length}</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>may need attention</p>
                </div>
              </div>
              {overviewData.needsAttention.length > 0 && (
                <p className="text-xs rounded-xl p-3 mb-4" style={{ background: COLORS.layer3Tint, color: COLORS.layer3Deep }}>💡 Haven't checked in for a while: {overviewData.needsAttention.join(', ')}.</p>
              )}
              {overviewData.ranked.map(p => {
                const l = getLayer(p.layer);
                return (
                  <button key={p.id} onClick={() => onOpenPerson(p.id)} className="w-full text-left mb-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar emoji={p.emoji} size={28} ringColor={l.color} />
                      <span className="text-sm font-semibold flex-1" style={{ color: COLORS.ink }}>{p.name}</span>
                      {p.trend === 'up' && <span aria-label="trending up" className="text-sm font-semibold" style={{ color: COLORS.good }}>↑</span>}
                      {p.trend === 'down' && <span aria-label="trending down" className="text-sm font-semibold" style={{ color: COLORS.alert }}>↓</span>}
                      <span className="font-display" style={{ fontSize: 16, color: l.color }}>{p.overall}%</span>
                    </div>
                    <ProgressBar percent={p.overall} color={l.color} height={6} />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        {LAYERS.slice().reverse().map(l => (
          <div key={l.id} className="mb-2 rounded-xl p-3" style={{ background: l.tint }}>
            <p className="text-xs font-semibold" style={{ color: l.deep }}>Layer {l.id}: {l.fullName}</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{l.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== PERSON PROFILE ============================== */

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

function PersonProfile({ person, onBack, onOpenLog, onOpenGoalCreate, onOpenGoalEdit, onDeleteGoal, onBumpGoal, onOpenAddInfo, onSaveInfo, onDeleteInfo, onToggleTemporary, onToggleArchive, onAdjust, onOpenCoach, onEditPerson }) {
  const [showAdjust, setShowAdjust] = useState(false);
  const [draft, setDraft] = useState(person.dims);
  const [showArchived, setShowArchived] = useState({});
  const l = getLayer(person.layer);
  const suggestions = useMemo(() => generateSuggestions(person), [person]);

  function openAdjust() { setDraft(person.dims); setShowAdjust(true); }
  function saveAdjust() { onAdjust(draft); setShowAdjust(false); }

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
          <button onClick={() => onOpenCoach(person.id)} className="text-xs font-semibold rounded-full px-4 py-2" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Prepare to talk</button>
        </div>
      </div>

      <div className="flex flex-col items-center mt-7">
        <CircularProgress percent={person.overall} size={160} stroke={13} color={l.color} label="Relationship development" />
        <p className="text-xs text-center mt-3" style={{ color: COLORS.inkSoft, maxWidth: 280 }}>Based on your logged interactions and current goals. This is an estimate, not an objective measurement of your friendship.</p>
      </div>

      {person.lastChange && (
        <div className="mt-5 rounded-2xl p-4" style={{ background: l.tint }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: l.deep }}>{person.lastChange.before}% → {person.lastChange.after}%</p>
            <p className="text-sm font-semibold" style={{ color: l.deep }}>+{Math.max(0, person.lastChange.after - person.lastChange.before)}%</p>
          </div>
          <p className="text-xs mt-1 mb-1.5" style={{ color: COLORS.inkSoft }}>Why:</p>
          {person.lastChange.why.map((w, i) => (<p key={i} className="text-xs" style={{ color: COLORS.ink }}>✓ {w}</p>))}
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
            <GoalRow key={g.id} goal={g} color={l.color}
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
                  <button onClick={() => onOpenAddInfo(person.id, cat.key)} className="p-1"><Plus size={16} color={COLORS.accent} /></button>
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
                        onToggleArchive={() => onToggleArchive(person.id, cat.key, item.id)} />
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
          <Timeline steps={[...person.timeline, { label: `Current: ${l.name}`, date: 'Now', current: true }]} />
        </div>
      </div>

      <div className="mt-2">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Progress</p>
        <div className="mt-3" style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={person.history} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={26} />
              <Tooltip formatter={(v) => [`${v}%`, 'Progress']} contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke={l.color} strokeWidth={2.5} dot={{ r: 3, fill: l.color }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs mt-3 text-center" style={{ color: COLORS.inkSoft }}>Relationships don't have to move in a straight line. It's normal to move between layers.</p>
      </div>
    </div>
  );
}

/* ============================== GOALS OVERVIEW ============================== */

function GoalsView({ people, generalGoals, onBack, onOpenPerson, onOpenGoalCreate, onOpenGoalEdit, onDeleteGoal, onBumpGoal }) {
  const [filter, setFilter] = useState('active');
  const passFilter = g => filter === 'all' ? true : filter === 'active' ? g.progress < 100 : g.progress >= 100;

  const groups = useMemo(() => {
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
        <button onClick={() => onOpenGoalCreate(null)} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accent, color: '#fff' }}>
          <Plus size={14} /> New goal
        </button>
      </div>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{totalActive} in progress, {totalDone} completed.</p>

      <div className="flex items-center gap-2 mt-4">
        {['active', 'completed', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: filter === f ? COLORS.accent : COLORS.paperRaised, color: filter === f ? '#fff' : COLORS.inkSoft, border: `1px solid ${filter === f ? COLORS.accent : COLORS.line}` }}>
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
              <GoalRow key={g.id} goal={g} color={grp.color}
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

/* ============================== JOURNAL ============================== */

function JournalView({ people, journal, onOpenPerson }) {
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

  const groups = [];
  filtered.forEach(entry => {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) { last.entries.push(entry); } else { groups.push({ date: entry.date, entries: [entry] }); }
  });

  const typeKeys = Object.keys(TYPE_META);

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Journal</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>Every interaction, in one place.</p>

      <div className="flex items-center gap-2 mt-4">
        <Search size={15} color={COLORS.inkSoft} className="shrink-0" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the journal..." className="flex-1 text-sm rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.line}` }} />
      </div>

      <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
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
          <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>No interactions match this filter.</p>
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

/* ============================== CONVERSATION COACH ============================== */

const HOOKS = [
  { key: 'activity', label: 'Activity', question: 'What got you into tennis?' },
  { key: 'experience', label: 'Experience', question: 'How has it been so far?' },
  { key: 'emotion', label: 'Emotion', question: 'Are you enjoying it?' },
  { key: 'future', label: 'Future', question: 'Would you ever want to play competitively?' },
  { key: 'opinion', label: 'Opinion', question: "What's the best part about it?" },
];

function CoachView({ people, generalGoals, initialPersonId, initialTab, onOpenLog, onApproveInfo, onLogFromAnalysis, onOpenPerson }) {
  const [tab, setTab] = useState(initialTab || 'prepare');
  const [preparePersonId, setPreparePersonId] = useState(initialPersonId || (people[0] && people[0].id) || null);
  const [analysisPersonId, setAnalysisPersonId] = useState(initialTab === 'analyse' ? initialPersonId || null : null);
  const [step, setStep] = useState('pick');
  const [scenarioKey, setScenarioKey] = useState(null);
  const [infoStatus, setInfoStatus] = useState({});
  const [infoDrafts, setInfoDrafts] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    if (step === 'loading') {
      const t = setTimeout(() => setStep('results'), 900);
      return () => clearTimeout(t);
    }
  }, [step]);

  const preparePerson = people.find(p => p.id === preparePersonId) || null;
  const scenario = scenarioKey ? SCENARIOS[scenarioKey] : null;
  const scenarioPerson = people.find(p => p.id === analysisPersonId) || null;

  function pickScenario(key) {
    const sc = SCENARIOS[key];
    setScenarioKey(key);
    setInfoStatus({});
    setInfoDrafts(Object.fromEntries(sc.extractedInfo.map((it, i) => [i, it.text])));
    setEditingIndex(null);
    setLogged(false);
    setStep('loading');
  }
  function resetAnalyse() { setStep('pick'); setScenarioKey(null); }
  function changeAnalysisPerson() { setAnalysisPersonId(null); resetAnalyse(); }
  function saveInfoItem(i) {
    const it = scenario.extractedInfo[i];
    onApproveInfo(analysisPersonId, it.category, infoDrafts[i], it.temporary);
    setInfoStatus(s => ({ ...s, [i]: 'saved' }));
    setEditingIndex(null);
  }
  function ignoreInfoItem(i) { setInfoStatus(s => ({ ...s, [i]: 'ignored' })); setEditingIndex(null); }
  function handleLogAnalysis() { onLogFromAnalysis(analysisPersonId, scenario); setLogged(true); }

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Conversation Coach</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>Noticing, responding and adapting, not scripts.</p>

      <div className="flex items-center gap-2 mt-4">
        {[{ k: 'prepare', label: 'Prepare' }, { k: 'analyse', label: 'Analyse a chat' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: tab === t.k ? COLORS.accent : COLORS.paperRaised, color: tab === t.k ? '#fff' : COLORS.inkSoft, border: `1px solid ${tab === t.k ? COLORS.accent : COLORS.line}` }}>{t.label}</button>
        ))}
      </div>

      {tab === 'prepare' && (
        <div className="mt-5">
          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Who are you about to talk to?</p>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
            {people.map(p => {
              const active = preparePersonId === p.id; const l = getLayer(p.layer);
              return (
                <button key={p.id} onClick={() => setPreparePersonId(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                  <Avatar emoji={p.emoji} size={44} ringColor={active ? COLORS.accent : l.color} />
                  <span className="text-xs" style={{ color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
                </button>
              );
            })}
          </div>

          {preparePerson && (
            <div className="rounded-2xl p-4 mb-5" style={{ background: getLayer(preparePerson.layer).tint }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: getLayer(preparePerson.layer).deep }}>{preparePerson.name}</p>
                <LayerBadge layerId={preparePerson.layer} />
              </div>
              {preparePerson.goals.filter(g => g.progress < 100).slice(0, 2).length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Active goals</p>
                  {preparePerson.goals.filter(g => g.progress < 100).slice(0, 2).map(g => (<p key={g.id} className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{g.title}: {g.progress}%</p>))}
                </div>
              )}
              {preparePerson.interests.filter(i => !i.archived).length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Known interests</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {preparePerson.interests.filter(i => !i.archived).map(i => (<span key={i.id} className="text-xs rounded-full px-2 py-0.5" style={{ background: COLORS.paperRaised }}>{i.emoji} {i.text}</span>))}
                  </div>
                </div>
              )}
              {preparePerson.plans.filter(i => !i.archived).length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Things they've mentioned</p>
                  {preparePerson.plans.filter(i => !i.archived).slice(0, 2).map(i => (<p key={i.id} className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{i.emoji} {i.text}</p>))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Spot the hooks</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>They say: "I started playing tennis recently."</p>
            <div className="grid grid-cols-1 gap-1.5 mt-2.5">
              {HOOKS.map(h => (
                <div key={h.key} className="rounded-xl px-3 py-2" style={{ background: COLORS.accentSoft }}>
                  <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>{h.label}: </span>
                  <span className="text-xs" style={{ color: COLORS.ink }}>{h.question}</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>The best follow-up is usually based on something the person actually seems interested in discussing.</p>
          </div>

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Listen → follow up → share → follow up → listen</p>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Person: "I went skiing last weekend."</p>
            <p className="text-xs mt-1" style={{ color: COLORS.ink }}>You: "I've only been once and I was terrible. Where did you go?"</p>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs" style={{ color: COLORS.good }}>✓ Responded to their topic</p>
              <p className="text-xs" style={{ color: COLORS.good }}>✓ Shared something personal</p>
              <p className="text-xs" style={{ color: COLORS.good }}>✓ Asked a relevant follow-up</p>
            </div>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Conversation shouldn't become an interview. Share as often as you ask.</p>
          </div>

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Spotting hand-offs</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Person: "I've been getting really into F1 lately."</p>
            <p className="text-xs mt-1" style={{ color: COLORS.ink }}>If you like F1 too, this is a natural moment to share your own experience rather than asking another question.</p>
          </div>

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Encourager check</p>
            <p className="text-xs mt-2 font-semibold" style={{ color: COLORS.good }}>Good: "Really? What happened?" right after they share a story.</p>
            <p className="text-xs mt-2 font-semibold" style={{ color: COLORS.alert }}>Poor: "Really?" "Really?" "Tell me more." repeated after short answers.</p>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Encouragers help when they respond to something real, not just to fill space.</p>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button onClick={() => onOpenLog(preparePersonId)} className="flex-1 text-sm font-semibold rounded-full py-3 text-center" style={{ background: COLORS.accent, color: '#fff' }}>Log this conversation</button>
            <button onClick={() => { setAnalysisPersonId(preparePersonId); setTab('analyse'); }} className="flex-1 text-sm font-semibold rounded-full py-3 text-center" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Analyse a screenshot</button>
          </div>

          <p className="text-xs text-center mt-5" style={{ color: COLORS.inkSoft }}>Good social skills are about noticing, responding and adapting, not forcing a particular outcome.</p>
        </div>
      )}

      {tab === 'analyse' && (
        <div className="mt-5">
          {people.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Add someone in the People tab first, then come back to analyse a conversation with them.</p>
          ) : !analysisPersonId ? (
            <>
              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Who is this conversation with?</p>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {people.map(p => {
                  const l = getLayer(p.layer);
                  return (
                    <button key={p.id} onClick={() => setAnalysisPersonId(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                      <Avatar emoji={p.emoji} size={44} ringColor={l.color} />
                      <span className="text-xs" style={{ color: COLORS.inkSoft }}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {step === 'pick' && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar emoji={scenarioPerson.emoji} size={30} ringColor={getLayer(scenarioPerson.layer).color} />
                    <p className="text-sm" style={{ color: COLORS.inkSoft }}>Analysing a conversation with <span className="font-semibold" style={{ color: COLORS.ink }}>{scenarioPerson.name}</span></p>
                  </div>
                  <p className="text-xs rounded-xl p-3 mb-4" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>🔒 Only analyse conversations you're allowed to share. This is a prototype. Try a sample conversation below to see how analysis works.</p>
                  <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Try a sample conversation</p>
                  {Object.values(SCENARIOS).map(sc => (
                    <button key={sc.key} onClick={() => pickScenario(sc.key)} className="w-full flex items-center gap-3 rounded-2xl p-3.5 mb-2 text-left" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                      <span style={{ fontSize: 22 }}>📸</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{sc.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{sc.preview}</p>
                      </div>
                    </button>
                  ))}
                  <button onClick={changeAnalysisPerson} className="text-xs font-medium mt-2" style={{ color: COLORS.inkSoft }}>Change person</button>
                </>
              )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid ${COLORS.line}`, borderTopColor: COLORS.accent }} className="spin" />
              <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>Reading the conversation...</p>
            </div>
          )}

          {step === 'results' && scenario && (
            <div>
              <button onClick={resetAnalyse} className="text-xs font-medium mb-3" style={{ color: COLORS.inkSoft }}>← Try a different sample</button>

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Reconstructed conversation</p>
              <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}` }}>
                {scenario.transcript.map((m, i) => (<ChatBubble key={i} who={m.who} text={m.text} />))}
              </div>

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Conversation state</p>
              <div className="mb-4"><ConvStateBadge stateKey={scenario.conversationState} /></div>
              {scenario.recommendation && (
                <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.layer4Tint }}>
                  <p className="text-sm font-semibold" style={{ color: COLORS.layer4Deep }}>You don't need to force another topic.</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.recommendation}</p>
                </div>
              )}

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Conversation review</p>
              <div className="rounded-2xl p-4 mb-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Overall</span>
                  <span className="font-display" style={{ fontSize: 22, color: COLORS.accent }}>{scenario.grading.overall}%</span>
                </div>
                <div className="space-y-2.5">
                  <LabeledBar label="Depth" percent={scenario.grading.depth} color={DIM_COLORS.depth} />
                  <LabeledBar label="Active listening" percent={scenario.grading.activeListening} color={DIM_COLORS.listening} />
                  <LabeledBar label="Reciprocity" percent={scenario.grading.reciprocity} color={DIM_COLORS.reciprocity} />
                  <LabeledBar label="Naturalness" percent={scenario.grading.naturalness} color={COLORS.teal} />
                </div>
                <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Goal progress: <span style={{ color: COLORS.good, fontWeight: 700 }}>+{scenario.grading.goalImpact}%</span></p>
              </div>

              <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>What went well</p>
                {scenario.wentWell.map((w, i) => (<p key={i} className="text-xs mb-0.5" style={{ color: COLORS.good }}>✓ {w}</p>))}
                <p className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.ink }}>Opportunity</p>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>{scenario.opportunity}</p>
                <p className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.ink }}>Try next time</p>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>{scenario.tryNextTime}</p>
              </div>

              <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>Encourager use</p>
                <p className="text-xs font-medium" style={{ color: scenario.encourager.type === 'good' ? COLORS.good : COLORS.alert }}>{scenario.encourager.type === 'good' ? 'Good use' : 'Could improve'}: {scenario.encourager.line}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{scenario.encourager.why}</p>
              </div>

              <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>Possible emotional cues</p>
                {scenario.emotionalCues.map((e, i) => (
                  <p key={i} className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{e.emoji} {e.text}</p>
                ))}
                <p className="text-xs mt-2 italic" style={{ color: COLORS.inkSoft }}>These are possible interpretations, not facts.</p>
              </div>

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Information mentioned</p>
              {scenario.extractedInfo.map((it, i) => {
                const status = infoStatus[i];
                const cat = categoryMeta(it.category);
                return (
                  <div key={i} className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                    <div className="flex items-center gap-2">
                      <span>{cat.emoji}</span>
                      {editingIndex === i ? (
                        <input autoFocus value={infoDrafts[i]} onChange={e => setInfoDrafts(d => ({ ...d, [i]: e.target.value }))} className="flex-1 text-sm rounded-lg px-2 py-1" style={{ border: `1px solid ${COLORS.accent}` }} />
                      ) : (
                        <p className="text-sm flex-1" style={{ color: COLORS.ink }}>{infoDrafts[i]}</p>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Category: {cat.label}{it.temporary ? ' (temporary)' : ''}</p>
                    {status === 'saved' ? (
                      <p className="text-xs mt-1.5 font-medium" style={{ color: COLORS.good }}><Check size={11} /> Saved to {scenarioPerson ? scenarioPerson.name : 'profile'}</p>
                    ) : status === 'ignored' ? (
                      <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Ignored</p>
                    ) : (
                      <div className="flex items-center gap-3 mt-1.5">
                        <button onClick={() => saveInfoItem(i)} className="text-xs font-semibold" style={{ color: COLORS.accent }}>Save</button>
                        <button onClick={() => setEditingIndex(i)} className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Edit</button>
                        <button onClick={() => ignoreInfoItem(i)} className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Ignore</button>
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="text-sm font-semibold mt-4 mb-2" style={{ color: COLORS.ink }}>What to say next</p>
              {scenario.next.continueTopic && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Continue the current topic</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.continueTopic.text}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}><span className="font-semibold">Natural:</span> {scenario.next.continueTopic.natural}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}><span className="font-semibold">Playful:</span> {scenario.next.continueTopic.playful}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}><span className="font-semibold">Deeper:</span> {scenario.next.continueTopic.deeper}</p>
                  </div>
                </div>
              )}
              {scenario.next.shareYourself && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Share something yourself</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.shareYourself.text}</p>
                </div>
              )}
              {scenario.next.changeTopic && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Change topic naturally</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.changeTopic.text}</p>
                </div>
              )}
              {scenario.next.dontMessage && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.layer4Tint }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.layer4Deep }}>Don't message yet</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.dontMessage.text}</p>
                </div>
              )}

              <div className="mt-5">
                {logged ? (
                  <p className="text-sm text-center font-medium" style={{ color: COLORS.good }}>✓ Logged and updated {scenarioPerson ? scenarioPerson.name : 'their'} progress</p>
                ) : (
                  <button onClick={handleLogAnalysis} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.accent, color: '#fff' }}>Log this as an interaction</button>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================== ME / SOCIAL SKILLS ============================== */

function MeView({ people, journal, skills, generalGoals, profile, onBack, onRestoreSample, onStartOver, onExport, onImportClick, hasUpdater, updateStatus, onCheckForUpdates, onInstallUpdate, theme, onSetTheme, hasSystemBridge, autoLaunch, onToggleAutoLaunch }) {
  const [chartSkill, setChartSkill] = useState(FOCUS_SKILL_KEY);

  const strengthKey = useMemo(() => SKILL_ORDER.reduce((best, k) => skills[k].current > skills[best].current ? k : best, SKILL_ORDER[0]), [skills]);

  const unlocked = useMemo(() => {
    const totalInfo = people.reduce((sum, p) => sum + CATEGORIES.reduce((s2, c) => s2 + p[c.key].length, 0), 0);
    const totalAL = journal.reduce((sum, j) => sum + (j.activeListening ? j.activeListening.length : 0), 0);
    const deepLayers = people.filter(p => p.layer >= 3).length;
    return {
      firstMeaningful: journal.some(j => j.meaningfulness >= 4),
      activeListener: totalAL >= 5,
      remembered10: totalInfo >= 10,
      reciprocityMaster: skills.reciprocity.current >= 75,
      relationshipBuilder: deepLayers >= 2,
    };
  }, [people, journal, skills]);

  return (
    <div className="fade-anim px-5 pt-6 pb-6">
      <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Your social skills</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>Your own development, tracked privately.</p>

      <div className="mt-5 space-y-3.5">
        {SKILL_ORDER.map(k => (<LabeledBar key={k} label={skills[k].label} percent={skills[k].current} color={COLORS.accent} size="lg" />))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 mt-6">
        <div className="rounded-2xl p-3.5" style={{ background: COLORS.accentSoft }}>
          <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Your biggest strength</p>
          <p className="text-sm mt-1" style={{ color: COLORS.ink }}>🎧 {skills[strengthKey].label}</p>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: COLORS.layer3Tint }}>
          <p className="text-xs font-semibold" style={{ color: COLORS.layer3Deep }}>Current focus</p>
          <p className="text-sm mt-1" style={{ color: COLORS.ink }}>🔄 {skills[FOCUS_SKILL_KEY].label}</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{FOCUS_TEXT}</p>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Current challenge</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{CHALLENGE_TEXT}</p>
        </div>
      </div>

      <div className="mt-7">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Progress history</p>
        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          {SKILL_ORDER.map(k => (
            <button key={k} onClick={() => setChartSkill(k)} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: chartSkill === k ? COLORS.accent : COLORS.paperRaised, color: chartSkill === k ? '#fff' : COLORS.inkSoft, border: `1px solid ${chartSkill === k ? COLORS.accent : COLORS.line}` }}>{skills[k].label}</button>
          ))}
        </div>
        <div className="mt-3" style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={skills[chartSkill].history} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={26} />
              <Tooltip formatter={(v) => [`${v}%`, skills[chartSkill].label]} contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke={COLORS.accent} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.accent }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-7">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Achievements</p>
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {ACHIEVEMENTS.map(a => {
            const isUnlocked = unlocked[a.key];
            return (
              <div key={a.key} className="rounded-2xl p-3.5" style={{ background: isUnlocked ? COLORS.accentSoft : COLORS.paperRaised, border: `1px solid ${isUnlocked ? COLORS.accentSoft : COLORS.line}`, opacity: isUnlocked ? 1 : 0.55 }}>
                <span style={{ fontSize: 22 }}>{a.emoji}</span>
                <p className="text-xs font-semibold mt-1.5" style={{ color: COLORS.ink }}>{a.title}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{a.desc}</p>
                {!isUnlocked && <p className="text-xs mt-1 font-medium" style={{ color: COLORS.inkSoft }}>Locked</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-7 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Appearance</p>
        <div className="flex items-center gap-2 mt-3">
          {['light', 'dark'].map(t => (
            <button key={t} onClick={() => onSetTheme(t)} aria-pressed={theme === t} className="text-xs font-semibold rounded-full px-3 py-1.5 capitalize" style={{ background: theme === t ? COLORS.accent : COLORS.paperRaised, color: theme === t ? '#fff' : COLORS.inkSoft, border: `1px solid ${theme === t ? COLORS.accent : COLORS.line}` }}>{t}</button>
          ))}
        </div>
      </div>

      {hasSystemBridge && (
        <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Startup</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Launch Layers automatically when you log in, so it's already running in the tray.</p>
          <button onClick={onToggleAutoLaunch} aria-pressed={autoLaunch} className="flex items-center gap-2 mt-3 text-xs font-semibold rounded-full px-3 py-2" style={{ background: autoLaunch ? COLORS.accentSoft : COLORS.paperRaised, color: autoLaunch ? COLORS.accent : COLORS.inkSoft, border: `1px solid ${autoLaunch ? COLORS.accent : COLORS.line}` }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid currentColor`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{autoLaunch && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />}</span>
            {autoLaunch ? 'Launching at login' : 'Launch at login'}
          </button>
          <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>Global shortcut: <span style={{ fontWeight: 600, color: COLORS.ink }}>Ctrl+Shift+L</span> opens Layers and starts logging an interaction from anywhere. In-app, press <span style={{ fontWeight: 600, color: COLORS.ink }}>N</span> to do the same, and <span style={{ fontWeight: 600, color: COLORS.ink }}>Esc</span> to close any open dialog.</p>
        </div>
      )}

      {hasUpdater && (
        <div className="mt-7 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>App updates</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{updateStatusText(updateStatus)}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {updateStatus && updateStatus.state === 'ready' ? (
              <button onClick={onInstallUpdate} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accent, color: '#fff' }}>Restart &amp; install</button>
            ) : (
              <button onClick={onCheckForUpdates} disabled={!!(updateStatus && (updateStatus.state === 'checking' || updateStatus.state === 'downloading'))} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Check for updates</button>
            )}
          </div>
        </div>
      )}

      <div className="mt-7 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Backup</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Save a copy of everything to a file, or bring one back in. Handy before switching devices or reinstalling.</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={onExport} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}><Download size={13} /> Export data</button>
          <button onClick={onImportClick} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}><Upload size={13} /> Import data</button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Privacy</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Layers is a private personal-development tool. Everything is saved only on this device. Screenshot analysis never happens automatically, and extracted information always waits for your approval before it's saved.</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={onRestoreSample} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Restore sample data</button>
          <button onClick={onStartOver} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.layer4Tint, color: COLORS.layer4Deep }}>Delete my data and start over</button>
        </div>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: COLORS.inkSoft }}>Good social skills are about noticing, responding and adapting, not forcing a particular outcome.</p>
    </div>
  );
}

/* ============================== ONBOARDING ============================== */

function OnboardingView({ initialName, initialFocus, onComplete }) {
  const [step, setStep] = useState('intro');
  const [name, setName] = useState(initialName || '');
  const [focus, setFocus] = useState(initialFocus || null);
  const [draftPeople, setDraftPeople] = useState([]);
  const [newName, setNewName] = useState('');
  const canContinue = name.trim().length > 0;

  function addDraftPerson() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setDraftPeople(prev => [...prev, { name: trimmed, emoji: PERSON_EMOJIS[prev.length % PERSON_EMOJIS.length] }]);
    setNewName('');
  }
  function removeDraftPerson(i) { setDraftPeople(prev => prev.filter((_, idx) => idx !== i)); }

  if (step === 'people') {
    return (
      <div className="fade-anim px-6 pt-10 pb-8">
        <button onClick={() => setStep('intro')} className="flex items-center gap-1 text-sm font-medium mb-4" style={{ color: COLORS.inkSoft }}><ChevronLeft size={18} /> Back</button>
        <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Who's in your circle?</p>
        <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>Add as many as you'd like now — everyone starts at Orientation, and you can adjust or add more any time.</p>

        {draftPeople.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {draftPeople.map((p, i) => (
              <span key={i} className="flex items-center gap-1.5 text-sm rounded-full pl-2.5 pr-1.5 py-1.5" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                {p.emoji} {p.name}
                <button onClick={() => removeDraftPerson(i)} aria-label={`Remove ${p.name}`} className="p-0.5"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-5">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraftPerson(); } }} placeholder="Someone's name" aria-label="Person's name" className="flex-1 text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
          <button onClick={addDraftPerson} className="text-xs font-semibold rounded-full px-4 py-2.5" style={{ background: COLORS.accent, color: '#fff' }}>Add</button>
        </div>

        <div className="mt-9">
          <button onClick={() => onComplete({ name: name.trim(), focus, startFresh: true, newPeople: draftPeople })} className="w-full text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: COLORS.accent, color: '#fff' }}>{draftPeople.length > 0 ? `Continue with ${draftPeople.length} ${draftPeople.length === 1 ? 'person' : 'people'}` : 'Continue'}</button>
          <button onClick={() => onComplete({ name: name.trim(), focus, startFresh: true, newPeople: [] })} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}>Skip, I'll add people later</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-anim px-6 pt-10 pb-8">
      <p className="font-display" style={{ fontSize: 28, color: COLORS.ink }}>Welcome to Layers</p>
      <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>A private space to be more intentional about your relationships and your own social skills. Everything here stays on this device, only for you.</p>

      <p className="text-sm font-semibold mt-8 mb-2" style={{ color: COLORS.ink }}>What should we call you?</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />

      <p className="text-sm font-semibold mt-6 mb-2" style={{ color: COLORS.ink }}>What brings you here?</p>
      <div className="grid grid-cols-2 gap-2">
        {FOCUS_OPTIONS.map(o => (
          <button key={o.key} onClick={() => setFocus(o.key)} aria-pressed={focus === o.key} className="rounded-2xl p-3 text-left" style={{ background: focus === o.key ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${focus === o.key ? COLORS.accent : COLORS.line}` }}>
            <span className="text-xs font-semibold" style={{ color: focus === o.key ? COLORS.accent : COLORS.ink }}>{o.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-9">
        <button onClick={() => canContinue && setStep('people')} disabled={!canContinue} className="w-full text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: canContinue ? COLORS.accent : COLORS.line, color: canContinue ? '#fff' : COLORS.inkSoft }}>Start fresh with my own people</button>
        <button onClick={() => canContinue && onComplete({ name: name.trim(), focus, startFresh: false })} disabled={!canContinue} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: canContinue ? COLORS.accent : COLORS.inkSoft, border: `1px solid ${canContinue ? COLORS.accent : COLORS.line}` }}>Explore with example people first</button>
        <p className="text-xs text-center mt-3" style={{ color: COLORS.inkSoft }}>You can clear the examples any time from the Me tab.</p>
      </div>
    </div>
  );
}

/* ============================== MODALS ============================== */

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="sheet">
      <div className="sheet-overlay" onClick={onCancel} />
      <div className="sheet-panel sheet-anim" style={{ maxHeight: 'none' }} role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="px-5 pt-5 pb-5">
          <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>{title}</p>
          <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>{message}</p>
          <div className="flex items-center gap-2 mt-5">
            <button onClick={onCancel} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>Cancel</button>
            <button onClick={onConfirm} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: danger ? COLORS.layer4Deep : COLORS.accent, color: '#fff' }}>{confirmLabel || 'Confirm'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPersonModal({ person, onClose, onSave, onDelete }) {
  const [emoji, setEmoji] = useState(person.emoji);
  const [name, setName] = useState(person.name);
  const canSave = name.trim().length > 0;

  return (
    <Sheet title="Edit person" onClose={onClose}
      footer={<button onClick={() => canSave && onSave({ name: name.trim(), emoji })} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>Save changes</button>}>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Avatar</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {PERSON_EMOJIS.map(e => (
          <button key={e} onClick={() => setEmoji(e)} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 20 }}>{e}</button>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Name</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} className="w-full text-sm rounded-xl px-3 py-2.5 mb-6" style={{ border: `1px solid ${COLORS.line}` }} />
      <button onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full py-3" style={{ background: COLORS.layer4Tint, color: COLORS.layer4Deep }}><Trash2 size={13} /> Remove this person</button>
    </Sheet>
  );
}

function LogInteractionModal({ people, defaultPersonId, onClose, onSubmit }) {
  const [personId, setPersonId] = useState(defaultPersonId || (people[0] && people[0].id) || null);
  const [type, setType] = useState(null);
  const [meaningfulness, setMeaningfulness] = useState(3);
  const [notes, setNotes] = useState([]);
  const [draftCat, setDraftCat] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [al, setAl] = useState([]);

  const ML_LABELS = ['Very brief', 'Casual', 'Good conversation', 'Personal', 'Deep conversation'];
  const NOTE_BUTTONS = [
    { key: 'interests', label: '+ New interest' },
    { key: 'plans', label: '+ New plan' },
    { key: 'important', label: '+ Follow-up' },
  ];

  function toggleAL(key) { setAl(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]); }
  function addNote() {
    if (!draftText.trim()) return;
    setNotes(prev => [...prev, { id: uid(), category: draftCat, text: draftText.trim() }]);
    setDraftText(''); setDraftCat(null);
  }
  function removeNote(id) { setNotes(prev => prev.filter(n => n.id !== id)); }

  const canSave = personId && type;
  function handleSave() { if (!canSave) return; onSubmit({ personId, type, meaningfulness, notes, activeListening: al }); }

  return (
    <Sheet title="Log an interaction" onClose={onClose}
      footer={
        <div>
          <button onClick={handleSave} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>Save interaction</button>
          <p className="text-xs text-center mt-2" style={{ color: COLORS.inkSoft }}>Only who and what happened are needed. Everything else is optional.</p>
        </div>
      }>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Who was this with?</p>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
        {people.map(p => {
          const active = personId === p.id; const l = getLayer(p.layer);
          return (
            <button key={p.id} onClick={() => setPersonId(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
              <Avatar emoji={p.emoji} size={44} ringColor={active ? COLORS.accent : l.color} />
              <span className="text-xs" style={{ color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What happened?</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {TYPE_ORDER.map(key => {
          const meta = TYPE_META[key]; const active = type === key;
          return (
            <button key={key} onClick={() => setType(key)} className="rounded-2xl py-3 flex flex-col items-center gap-1" style={{ background: active ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}` }}>
              <span style={{ fontSize: 20 }}>{meta.emoji}</span>
              <span className="text-xs" style={{ color: active ? COLORS.accent : COLORS.ink, fontWeight: active ? 700 : 500 }}>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>How meaningful was it?</p>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {[1, 2, 3, 4, 5].map(n => {
          const active = meaningfulness === n;
          return (<button key={n} onClick={() => setMeaningfulness(n)} style={{ width: 38, height: 38, borderRadius: '50%', background: active ? COLORS.accent : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}`, color: active ? '#fff' : COLORS.ink, fontWeight: 700, fontSize: 14 }}>{n}</button>);
        })}
      </div>
      <p className="text-xs mb-5" style={{ color: COLORS.inkSoft }}>{ML_LABELS[meaningfulness - 1]}</p>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What did you learn?</p>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {NOTE_BUTTONS.map(nb => (
          <button key={nb.key} onClick={() => { setDraftCat(nb.key); setDraftText(''); }} className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>{nb.label}</button>
        ))}
      </div>
      {draftCat && (
        <div className="flex items-center gap-2 mb-2">
          <input autoFocus value={draftText} onChange={e => setDraftText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNote(); }} placeholder="Type what you learned..." className="flex-1 text-sm rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.accent}` }} />
          <button onClick={addNote} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accent, color: '#fff' }}>Add</button>
        </div>
      )}
      {notes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {notes.map(n => {
            const cat = categoryMeta(n.category);
            return (
              <span key={n.id} className="flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                {cat.emoji} {n.text}
                <button onClick={() => removeNote(n.id)} aria-label={`Remove note "${n.text}"`} className="p-0.5"><X size={11} /></button>
              </span>
            );
          })}
        </div>
      )}

      <p className="text-sm font-semibold mb-2 mt-1" style={{ color: COLORS.ink }}>Did you practise active listening?</p>
      <div>
        {AL_ITEMS.map(item => {
          const checked = al.includes(item.key);
          return (
            <button key={item.key} type="button" onClick={() => toggleAL(item.key)} className="w-full flex items-center gap-3 py-2 text-left">
              <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${checked ? COLORS.accent : COLORS.line}`, background: checked ? COLORS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {checked && <Check size={13} color="#fff" />}
              </span>
              <span className="text-sm" style={{ color: COLORS.ink }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function GoalModal({ people, defaultPersonId, editingGoal, editingPersonId, onClose, onSave }) {
  const isEdit = !!editingGoal;
  const [personId, setPersonId] = useState(isEdit ? editingPersonId : (defaultPersonId !== undefined ? defaultPersonId : (people[0] && people[0].id) || null));
  const [presetKey, setPresetKey] = useState(editingGoal ? editingGoal.type : null);
  const [customTitle, setCustomTitle] = useState(isEdit && editingGoal.type === 'custom' ? editingGoal.title : '');
  const [description, setDescription] = useState(editingGoal ? editingGoal.description : '');
  const [descTouched, setDescTouched] = useState(isEdit);

  function pickPreset(key) {
    setPresetKey(key);
    if (key !== 'custom' && !descTouched) {
      const preset = presetMeta(key);
      setDescription(preset ? preset.hint : '');
    }
  }

  const editingPerson = isEdit ? people.find(p => p.id === editingPersonId) : null;
  const canSave = presetKey && description.trim() && (presetKey !== 'custom' || customTitle.trim());

  function handleSave() {
    if (!canSave) return;
    const preset = presetMeta(presetKey);
    const title = presetKey === 'custom' ? customTitle.trim() : preset.label;
    const goalData = { id: isEdit ? editingGoal.id : uid(), personId: personId || null, category: preset.category, type: presetKey, title, description: description.trim(), progress: isEdit ? editingGoal.progress : 0, history: isEdit ? editingGoal.history : [{ date: 'Today', value: 0 }] };
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
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
          <button onClick={() => setPersonId(null)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 60 }}>
            <Avatar emoji="🎯" size={44} ringColor={personId === null ? COLORS.accent : COLORS.line} />
            <span className="text-xs" style={{ color: personId === null ? COLORS.accent : COLORS.inkSoft, fontWeight: personId === null ? 700 : 500 }}>General</span>
          </button>
          {people.map(p => {
            const active = personId === p.id; const l = getLayer(p.layer);
            return (
              <button key={p.id} onClick={() => setPersonId(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                <Avatar emoji={p.emoji} size={44} ringColor={active ? COLORS.accent : l.color} />
                <span className="text-xs" style={{ color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Relationship goals</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {relPresets.map(preset => {
          const active = presetKey === preset.key;
          return (
            <button key={preset.key} onClick={() => pickPreset(preset.key)} className="rounded-2xl p-3 text-left" style={{ background: active ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}` }}>
              <span style={{ fontSize: 18 }}>{preset.emoji}</span>
              <p className="text-xs font-semibold mt-1" style={{ color: active ? COLORS.accent : COLORS.ink }}>{preset.label}</p>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Social-skill goals</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {skillPresets.map(preset => {
          const active = presetKey === preset.key;
          return (
            <button key={preset.key} onClick={() => pickPreset(preset.key)} className="rounded-2xl p-3 text-left" style={{ background: active ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${active ? COLORS.accent : COLORS.line}` }}>
              <span style={{ fontSize: 18 }}>{preset.emoji}</span>
              <p className="text-xs font-semibold mt-1" style={{ color: active ? COLORS.accent : COLORS.ink }}>{preset.label}</p>
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
      <input value={description} onChange={e => { setDescription(e.target.value); setDescTouched(true); }} placeholder="Describe a measurable target" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
    </Sheet>
  );
}

function AddInfoModal({ personName, category, onClose, onSave }) {
  const cat = categoryMeta(category);
  const [emoji, setEmoji] = useState(cat.emoji);
  const [text, setText] = useState('');
  const [temporary, setTemporary] = useState(category === 'important');
  const canSave = text.trim().length > 0;

  return (
    <Sheet title={`Add to ${cat.label}`} onClose={onClose}
      footer={<button onClick={() => canSave && onSave({ emoji, text: text.trim(), temporary })} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>Save</button>}>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Adding to {personName}'s profile</p>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Choose an icon</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {EMOJI_CHOICES.map(e => (
          <button key={e} onClick={() => setEmoji(e)} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 18 }}>{e}</button>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Details</p>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={cat.placeholder} className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
      <button onClick={() => setTemporary(t => !t)} className="w-full flex items-center gap-3 mt-4">
        <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${temporary ? COLORS.accent : COLORS.line}`, background: temporary ? COLORS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {temporary && <Check size={13} color="#fff" />}
        </span>
        <span className="text-sm" style={{ color: COLORS.ink }}>This is temporary (e.g. a one-off event)</span>
      </button>
    </Sheet>
  );
}

function AddPersonModal({ onClose, onSave }) {
  const [emoji, setEmoji] = useState(PERSON_EMOJIS[0]);
  const [name, setName] = useState('');
  const [layer, setLayer] = useState(1);
  const canSave = name.trim().length > 0;

  return (
    <Sheet title="Add someone new" onClose={onClose}
      footer={<button onClick={() => canSave && onSave({ name: name.trim(), emoji, layer })} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>Add to my circle</button>}>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Choose an avatar</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {PERSON_EMOJIS.map(e => (
          <button key={e} onClick={() => setEmoji(e)} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 20 }}>{e}</button>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Name</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Their name" className="w-full text-sm rounded-xl px-3 py-2.5 mb-4" style={{ border: `1px solid ${COLORS.line}` }} />
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Where are you starting from?</p>
      <div className="grid grid-cols-2 gap-2">
        {LAYERS.map(l => (
          <button key={l.id} onClick={() => setLayer(l.id)} className="rounded-2xl p-3 text-left" style={{ background: layer === l.id ? l.tint : COLORS.paperRaised, border: `1.5px solid ${layer === l.id ? l.color : COLORS.line}` }}>
            <p className="text-xs font-semibold" style={{ color: layer === l.id ? l.deep : COLORS.ink }}>Layer {l.id}: {l.name}</p>
          </button>
        ))}
      </div>
      <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Not sure? Start at Orientation. You can log interactions to build things up from there.</p>
    </Sheet>
  );
}

/* ============================== APP ============================== */

function LayersApp() {
  const [saved] = useState(() => loadSaved());
  const [people, setPeople] = useState(() => (saved && Array.isArray(saved.people)) ? saved.people : INITIAL_PEOPLE);
  const [journal, setJournal] = useState(() => (saved && Array.isArray(saved.journal)) ? saved.journal : INITIAL_JOURNAL);
  const [generalGoals, setGeneralGoals] = useState(() => (saved && Array.isArray(saved.generalGoals)) ? saved.generalGoals : INITIAL_GENERAL_GOALS);
  const [skills, setSkills] = useState(() => (saved && saved.skills) ? saved.skills : INITIAL_SKILLS);
  const [profile, setProfile] = useState(() => (saved && saved.profile) ? saved.profile : { name: '', focus: null });
  const [onboarded, setOnboarded] = useState(() => !!(saved && saved.onboarded));
  const [theme, setTheme] = useState(() => (saved && saved.theme === 'dark') ? 'dark' : 'light');
  const [screen, setScreen] = useState({ name: 'tabs' });
  const [activeTab, setActiveTab] = useState('home');
  const [toasts, setToasts] = useState([]);
  const [coachInit, setCoachInit] = useState({ personId: null, tab: 'prepare' });
  const [updateStatus, setUpdateStatus] = useState(null);
  const hasUpdater = typeof window !== 'undefined' && !!window.layersUpdater;
  const hasSystemBridge = typeof window !== 'undefined' && !!window.layersSystem;
  const [autoLaunch, setAutoLaunch] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [logDefaultPerson, setLogDefaultPerson] = useState(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalDefaultPerson, setGoalModalDefaultPerson] = useState(null);
  const [goalEditing, setGoalEditing] = useState(null);
  const [addInfoOpen, setAddInfoOpen] = useState(false);
  const [addInfoTarget, setAddInfoTarget] = useState(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const importInputRef = useRef(null);

  function askConfirm(opts) {
    setConfirmState({ ...opts, onConfirm: () => { opts.onConfirm(); setConfirmState(null); }, onCancel: () => setConfirmState(null) });
  }

  useEffect(() => {
    persistState({ people, journal, generalGoals, skills, profile, onboarded, theme });
  }, [people, journal, generalGoals, skills, profile, onboarded, theme]);

  useEffect(() => {
    if (!onboarded) return;
    const t = setTimeout(() => {
      try {
        if (typeof Notification === 'undefined') return;
        const today = new Date().toISOString().slice(0, 10);
        if (getLastNotifiedDate() === today) return;
        const names = getCheckInSuggestions(people, journal);
        if (names.length === 0) return;
        const fire = () => {
          const list = names.slice(0, 2).join(' and ');
          const extra = names.length > 2 ? `, and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''}` : '';
          new Notification('Layers', { body: `It's been a while since you checked in with ${list}${extra}.` });
          setLastNotifiedDate(today);
        };
        if (Notification.permission === 'granted') fire();
        else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => { if (p === 'granted') fire(); });
        }
      } catch (e) { /* Notifications unavailable in this environment; ignore. */ }
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded]);

  useEffect(() => {
    if (!hasUpdater) return;
    const unsubscribe = window.layersUpdater.onStatus((status) => {
      setUpdateStatus(status);
      if (status.state === 'available') pushToast(`Downloading update v${status.version}...`);
      if (status.state === 'ready') pushToast(`Update v${status.version} ready — restart to install`);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUpdater]);

  function handleCheckForUpdates() {
    if (!hasUpdater) return;
    setUpdateStatus({ state: 'checking' });
    window.layersUpdater.checkForUpdates();
  }
  function handleInstallUpdate() {
    if (hasUpdater) window.layersUpdater.quitAndInstall();
  }

  useEffect(() => {
    if (!hasSystemBridge) return;
    window.layersSystem.getAutoLaunch().then(v => setAutoLaunch(!!v)).catch(() => {});
    const unsubscribe = window.layersSystem.onTriggerLog(() => { openLog(null); });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSystemBridge]);

  function handleToggleAutoLaunch() {
    if (!hasSystemBridge) return;
    const next = !autoLaunch;
    setAutoLaunch(next);
    window.layersSystem.setAutoLaunch(next);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (confirmState) { confirmState.onCancel(); return; }
        if (editPersonOpen) { closeEditPerson(); return; }
        if (addPersonOpen) { setAddPersonOpen(false); return; }
        if (addInfoOpen) { closeAddInfo(); return; }
        if (goalModalOpen) { closeGoalModal(); return; }
        if (logOpen) { closeLog(); return; }
        return;
      }
      const tag = document.activeElement && document.activeElement.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      const anyModalOpen = !!confirmState || editPersonOpen || addPersonOpen || addInfoOpen || goalModalOpen || logOpen;
      if (!typing && onboarded && !anyModalOpen && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        openLog(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState, editPersonOpen, addPersonOpen, addInfoOpen, goalModalOpen, logOpen, onboarded]);

  function pushToast(text) {
    const id = uid();
    setToasts(t => [...t, { id, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }

  const selectedPerson = screen.name === 'person' ? people.find(p => p.id === screen.personId) : null;

  function openPerson(id) { setScreen({ name: 'person', personId: id }); }
  function openGoalsOverview() { setScreen({ name: 'goals' }); }
  function backToTabs() { setScreen({ name: 'tabs' }); }
  function switchTab(tab) { setActiveTab(tab); setScreen({ name: 'tabs' }); }
  function openCoach(personId, tab) { setCoachInit({ personId: personId || null, tab: tab || 'prepare' }); setActiveTab('coach'); setScreen({ name: 'tabs' }); }

  function openLog(personId) {
    if (people.length === 0) { pushToast('Add someone in People first'); return; }
    setLogDefaultPerson(personId || null); setLogOpen(true);
  }
  function closeLog() { setLogOpen(false); }

  function handleLogSubmit({ personId, type, meaningfulness, notes, activeListening }) {
    const person = people.find(p => p.id === personId);
    setPeople(prev => prev.map(p => {
      if (p.id !== personId) return p;
      const depthBump = meaningfulness >= 4 ? Math.round(meaningfulness * 2.6) : Math.round(meaningfulness * 1.3);
      const trustBump = Math.round(meaningfulness * 2.2);
      const reciprocityBump = Math.round(meaningfulness * 1.6 + activeListening.length * 1.5);
      const interactionBump = Math.round(meaningfulness * 2.2);
      const sharedExpBump = (type === 'activity' || type === 'hangout') ? Math.round(meaningfulness * 2.6) : Math.round(meaningfulness * 0.8);
      const listeningBump = Math.round(activeListening.length * 3.5 + (meaningfulness >= 4 ? 2 : 0));
      const newDims = {
        depth: clamp(p.dims.depth + depthBump, 0, 100),
        trust: clamp(p.dims.trust + trustBump, 0, 100),
        reciprocity: clamp(p.dims.reciprocity + reciprocityBump, 0, 100),
        interaction: clamp(p.dims.interaction + interactionBump, 0, 100),
        sharedExperiences: clamp(p.dims.sharedExperiences + sharedExpBump, 0, 100),
        listening: clamp(p.dims.listening + listeningBump, 0, 100),
      };
      const newOverall = computeOverall(newDims);
      const newLayer = layerForOverall(newOverall);
      const goalBump = Math.round(meaningfulness * 3.2);
      const newGoals = p.goals.map(g => g.progress >= 100 ? g : { ...g, progress: clamp(g.progress + goalBump, 0, 100), history: [...g.history, { date: 'Today', value: clamp(g.progress + goalBump, 0, 100) }] });
      const newCats = {};
      CATEGORIES.forEach(c => { newCats[c.key] = p[c.key]; });
      notes.forEach(n => {
        const item = { id: uid(), emoji: categoryMeta(n.category).emoji, text: n.text, updated: 'Today', temporary: false, archived: false };
        newCats[n.category] = [item, ...newCats[n.category]];
      });
      const why = [];
      if (type === 'activity' || type === 'hangout') why.push('Shared an experience together');
      if (notes.some(n => n.category === 'interests')) why.push('Discovered a shared interest');
      if (activeListening.length >= 2) why.push('Good reciprocal conversation');
      if (meaningfulness >= 4) why.push('Personal experience discussed');
      if (why.length === 0) why.push('Logged a new interaction');
      return { ...p, dims: newDims, overall: newOverall, layer: newLayer, goals: newGoals, ...newCats, lastChange: { before: p.overall, after: newOverall, why }, history: [...p.history, { date: 'Today', value: newOverall }] };
    }));
    setJournal(prev => [{ id: uid(), personId, date: 'Today', isThisWeek: true, type, meaningfulness, added: notes.map(n => n.text), activeListening }, ...prev]);
    setSkills(prev => {
      const next = { ...prev };
      const bump = (key, amt) => { if (amt <= 0) return; next[key] = { ...next[key], current: clamp(next[key].current + amt, 0, 100) }; };
      bump('activeListening', activeListening.length);
      if (activeListening.includes('followup')) bump('followUp', 2);
      if (activeListening.includes('paraphrase') || activeListening.length >= 2) bump('reciprocity', 1);
      if (notes.length > 0) bump('selfDisclosure', 1);
      return next;
    });
    setLogOpen(false);
    pushToast(person ? `Logged time with ${person.name}` : 'Interaction logged');
  }

  function updateGoalsFor(personId, updater) {
    if (personId) { setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, goals: updater(p.goals) })); }
    else { setGeneralGoals(prev => updater(prev)); }
  }

  function openGoalCreate(personId) { setGoalEditing(null); setGoalModalDefaultPerson(personId === undefined ? null : personId); setGoalModalOpen(true); }
  function openGoalEdit(personId, goal) { setGoalEditing({ goal, personId }); setGoalModalDefaultPerson(personId); setGoalModalOpen(true); }
  function closeGoalModal() { setGoalModalOpen(false); setGoalEditing(null); }

  function handleGoalSave(personId, goalData, isEdit) {
    updateGoalsFor(personId, goals => isEdit ? goals.map(g => g.id === goalData.id ? goalData : g) : [...goals, goalData]);
    pushToast(isEdit ? 'Goal updated' : 'Goal added');
    setGoalModalOpen(false); setGoalEditing(null);
  }
  function handleDeleteGoal(personId, goalId, title) {
    askConfirm({
      title: 'Delete this goal?',
      message: title ? `"${title}" will be removed for good.` : 'This goal will be removed for good.',
      confirmLabel: 'Delete goal',
      danger: true,
      onConfirm: () => { updateGoalsFor(personId, goals => goals.filter(g => g.id !== goalId)); pushToast('Goal removed'); },
    });
  }
  function handleBumpGoal(personId, goalId) {
    let completed = false;
    updateGoalsFor(personId, goals => goals.map(g => {
      if (g.id !== goalId) return g;
      const next = clamp(g.progress + 20, 0, 100);
      if (next >= 100 && g.progress < 100) completed = true;
      return { ...g, progress: next, history: [...g.history, { date: 'Today', value: next }] };
    }));
    pushToast(completed ? 'Goal complete! 🎉' : 'Progress updated');
  }

  function openAddInfo(personId, category) { setAddInfoTarget({ personId, category }); setAddInfoOpen(true); }
  function closeAddInfo() { setAddInfoOpen(false); setAddInfoTarget(null); }
  function handleAddInfoSave({ emoji, text, temporary }) {
    const { personId, category } = addInfoTarget;
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: [{ id: uid(), emoji, text, updated: 'Today', temporary: !!temporary, archived: false }, ...p[category]] }));
    pushToast(`Added to ${categoryMeta(category).label}`);
    setAddInfoOpen(false); setAddInfoTarget(null);
  }
  function handleSaveInfoItem(personId, category, itemId, text) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].map(it => it.id === itemId ? { ...it, text, updated: 'Today' } : it) }));
  }
  function handleDeleteInfoItem(personId, category, itemId, text) {
    askConfirm({
      title: 'Delete this?',
      message: text ? `"${text}" will be removed for good.` : 'This will be removed for good.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => { setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].filter(it => it.id !== itemId) })); },
    });
  }
  function handleToggleTemporary(personId, category, itemId) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].map(it => it.id === itemId ? { ...it, temporary: !it.temporary } : it) }));
  }
  function handleToggleArchive(personId, category, itemId) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].map(it => it.id === itemId ? { ...it, archived: !it.archived } : it) }));
  }
  function handleApproveInfo(personId, category, text, temporary) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: [{ id: uid(), emoji: categoryMeta(category).emoji, text, updated: 'Today', temporary: !!temporary, archived: false }, ...p[category]] }));
    pushToast(`Saved to ${categoryMeta(category).label}`);
  }

  function handleAdjust(personId, dims) {
    setPeople(prev => prev.map(p => {
      if (p.id !== personId) return p;
      const overall = computeOverall(dims);
      const layer = layerForOverall(overall);
      return { ...p, dims, overall, layer, lastChange: { before: p.overall, after: overall, why: ['You manually adjusted these values'] }, history: [...p.history, { date: 'Today', value: overall }] };
    }));
    pushToast('Progress updated');
  }

  function handleLogFromAnalysis(personId, scenario) {
    const g = scenario.grading;
    setPeople(prev => prev.map(p => {
      if (p.id !== personId) return p;
      const newDims = {
        depth: clamp(p.dims.depth + Math.round(g.depth / 14), 0, 100),
        trust: clamp(p.dims.trust + Math.round(g.overall / 16), 0, 100),
        reciprocity: clamp(p.dims.reciprocity + Math.round(g.reciprocity / 14), 0, 100),
        interaction: clamp(p.dims.interaction + 4, 0, 100),
        sharedExperiences: clamp(p.dims.sharedExperiences + 2, 0, 100),
        listening: clamp(p.dims.listening + Math.round(g.activeListening / 14), 0, 100),
      };
      const newOverall = computeOverall(newDims);
      const newLayer = layerForOverall(newOverall);
      const goalBump = Math.round(g.overall / 10);
      const newGoals = p.goals.map(gl => gl.progress >= 100 ? gl : { ...gl, progress: clamp(gl.progress + goalBump, 0, 100), history: [...gl.history, { date: 'Today', value: clamp(gl.progress + goalBump, 0, 100) }] });
      return { ...p, dims: newDims, overall: newOverall, layer: newLayer, goals: newGoals, lastChange: { before: p.overall, after: newOverall, why: scenario.wentWell }, history: [...p.history, { date: 'Today', value: newOverall }] };
    }));
    setJournal(prev => [{ id: uid(), personId, date: 'Today', isThisWeek: true, type: 'analysed', meaningfulness: clamp(Math.round(g.overall / 20), 1, 5), added: [], activeListening: [], analysis: { grading: g, conversationState: scenario.conversationState } }, ...prev]);
    setSkills(prev => {
      const next = { ...prev };
      const bump = (key, amt) => { next[key] = { ...next[key], current: clamp(next[key].current + amt, 0, 100) }; };
      bump('activeListening', Math.round(g.activeListening / 25));
      bump('readingCues', 2);
      bump('reciprocity', Math.round(g.reciprocity / 25));
      if (scenario.conversationState === 'windingDown') bump('knowingWhenToStop', 3);
      return next;
    });
    const person = people.find(p => p.id === personId);
    pushToast(person ? `Logged and updated ${person.name}'s progress` : 'Interaction logged');
  }

  function handleAddPerson({ name, emoji, layer }) {
    const newPerson = makePerson({ name, emoji, layer });
    setPeople(prev => [...prev, newPerson]);
    pushToast(`${name} added to your circle`);
    setAddPersonOpen(false);
  }

  function openEditPerson() { setEditPersonOpen(true); }
  function closeEditPerson() { setEditPersonOpen(false); }
  function handleSavePersonEdit(personId, { name, emoji }) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, name, emoji }));
    pushToast('Person updated');
    setEditPersonOpen(false);
  }
  function handleDeletePerson(personId, name) {
    setEditPersonOpen(false);
    askConfirm({
      title: `Remove ${name}?`,
      message: `This deletes ${name}'s profile, goals, saved information, and everything logged about them. This cannot be undone.`,
      confirmLabel: 'Remove person',
      danger: true,
      onConfirm: () => {
        setPeople(prev => prev.filter(p => p.id !== personId));
        setJournal(prev => prev.filter(j => j.personId !== personId));
        setScreen({ name: 'tabs' }); setActiveTab('people');
        pushToast(`${name} was removed`);
      },
    });
  }

  function handleRestoreSample() {
    askConfirm({
      title: 'Restore sample data?',
      message: "This replaces your current people, goals, and journal with the built-in example data. Anything you've added will be lost unless you export it first.",
      confirmLabel: 'Restore samples',
      danger: true,
      onConfirm: () => {
        setPeople(INITIAL_PEOPLE); setJournal(INITIAL_JOURNAL); setGeneralGoals(INITIAL_GENERAL_GOALS); setSkills(INITIAL_SKILLS);
        setScreen({ name: 'tabs' }); setActiveTab('home');
        pushToast('Sample data restored');
      },
    });
  }

  function handleStartOver() {
    askConfirm({
      title: 'Delete all your data?',
      message: 'This permanently deletes every person, goal, and journal entry. This cannot be undone unless you export a backup first.',
      confirmLabel: 'Delete everything',
      danger: true,
      onConfirm: () => {
        setPeople([]); setJournal([]); setGeneralGoals([]); setSkills(EMPTY_SKILLS);
        setScreen({ name: 'tabs' }); setActiveTab('home');
        setOnboarded(false);
      },
    });
  }

  function handleExportData() {
    const data = { version: 1, exportedAt: new Date().toISOString(), people, journal, generalGoals, skills, profile };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layers-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast('Data exported');
  }

  function handleImportClick() { importInputRef.current && importInputRef.current.click(); }
  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('bad file');
        askConfirm({
          title: 'Import this backup?',
          message: 'This replaces everything currently in the app with the contents of this file.',
          confirmLabel: 'Import',
          danger: true,
          onConfirm: () => {
            setPeople(Array.isArray(data.people) ? data.people : []);
            setJournal(Array.isArray(data.journal) ? data.journal : []);
            setGeneralGoals(Array.isArray(data.generalGoals) ? data.generalGoals : []);
            setSkills(data.skills && typeof data.skills === 'object' ? data.skills : EMPTY_SKILLS);
            setProfile(data.profile && typeof data.profile === 'object' ? data.profile : { name: '', focus: null });
            setOnboarded(true);
            setScreen({ name: 'tabs' }); setActiveTab('home');
            pushToast('Backup imported');
          },
        });
      } catch (err) {
        pushToast('That file could not be read as a Layers backup');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleOnboardingComplete({ name, focus, startFresh, newPeople }) {
    setProfile({ name, focus });
    if (startFresh) {
      setPeople((newPeople || []).map(p => makePerson({ name: p.name, emoji: p.emoji, layer: 1 })));
      setJournal([]); setGeneralGoals([]); setSkills(EMPTY_SKILLS);
    } else {
      setPeople(INITIAL_PEOPLE); setJournal(INITIAL_JOURNAL); setGeneralGoals(INITIAL_GENERAL_GOALS); setSkills(INITIAL_SKILLS);
    }
    setOnboarded(true);
    setScreen({ name: 'tabs' }); setActiveTab('home');
  }

  return (
    <div className={`layers-root${theme === 'dark' ? ' dark' : ''}`} style={{ background: COLORS.paper, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{CSS}</style>
      <div className="phone-frame">
        <div className="scroll-area no-scrollbar" style={{ paddingBottom: (!onboarded || screen.name !== 'tabs') ? 30 : 110 }}>
          {!onboarded ? (
            <OnboardingView initialName={profile.name} initialFocus={profile.focus} onComplete={handleOnboardingComplete} />
          ) : (
            <>
              {screen.name === 'person' && selectedPerson && (
                <PersonProfile
                  person={selectedPerson}
                  onBack={backToTabs}
                  onOpenLog={openLog}
                  onOpenGoalCreate={openGoalCreate}
                  onOpenGoalEdit={openGoalEdit}
                  onDeleteGoal={handleDeleteGoal}
                  onBumpGoal={handleBumpGoal}
                  onOpenAddInfo={openAddInfo}
                  onSaveInfo={handleSaveInfoItem}
                  onDeleteInfo={handleDeleteInfoItem}
                  onToggleTemporary={handleToggleTemporary}
                  onToggleArchive={handleToggleArchive}
                  onAdjust={(dims) => handleAdjust(selectedPerson.id, dims)}
                  onOpenCoach={(pid) => openCoach(pid, 'prepare')}
                  onEditPerson={openEditPerson}
                />
              )}
              {screen.name === 'goals' && (
                <GoalsView people={people} generalGoals={generalGoals} onBack={backToTabs} onOpenPerson={openPerson} onOpenGoalCreate={openGoalCreate} onOpenGoalEdit={openGoalEdit} onDeleteGoal={handleDeleteGoal} onBumpGoal={handleBumpGoal} />
              )}
              {screen.name === 'tabs' && (
                <>
                  {activeTab === 'home' && <HomeView people={people} journal={journal} generalGoals={generalGoals} profile={profile} onOpenPerson={openPerson} onSwitchTab={switchTab} onOpenGoals={openGoalsOverview} onOpenCoach={(tab) => openCoach(null, tab)} />}
                  {activeTab === 'people' && <PeopleView people={people} journal={journal} onOpenPerson={openPerson} onAddPerson={() => setAddPersonOpen(true)} />}
                  {activeTab === 'coach' && <CoachView people={people} generalGoals={generalGoals} initialPersonId={coachInit.personId} initialTab={coachInit.tab} onOpenLog={openLog} onApproveInfo={handleApproveInfo} onLogFromAnalysis={handleLogFromAnalysis} onOpenPerson={openPerson} />}
                  {activeTab === 'journal' && <JournalView people={people} journal={journal} onOpenPerson={openPerson} />}
                  {activeTab === 'me' && <MeView people={people} journal={journal} skills={skills} generalGoals={generalGoals} profile={profile} onRestoreSample={handleRestoreSample} onStartOver={handleStartOver} onExport={handleExportData} onImportClick={handleImportClick} hasUpdater={hasUpdater} updateStatus={updateStatus} onCheckForUpdates={handleCheckForUpdates} onInstallUpdate={handleInstallUpdate} theme={theme} onSetTheme={setTheme} hasSystemBridge={hasSystemBridge} autoLaunch={autoLaunch} onToggleAutoLaunch={handleToggleAutoLaunch} />}
                </>
              )}
            </>
          )}
        </div>

        {onboarded && screen.name === 'tabs' && (
          <>
            <button className="fab-btn" onClick={() => openLog(null)} aria-label="Log an interaction"><Plus size={26} color="#fff" /></button>
            <BottomNav active={activeTab} onChange={switchTab} />
          </>
        )}

        <div className="toast-stack">
          {toasts.map(t => (<div key={t.id} className="toast">{t.text}</div>))}
        </div>

        <input ref={importInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />

        {logOpen && <LogInteractionModal people={people} defaultPersonId={logDefaultPerson} onClose={closeLog} onSubmit={handleLogSubmit} />}
        {goalModalOpen && <GoalModal people={people} defaultPersonId={goalModalDefaultPerson} editingGoal={goalEditing ? goalEditing.goal : null} editingPersonId={goalEditing ? goalEditing.personId : null} onClose={closeGoalModal} onSave={handleGoalSave} />}
        {addInfoOpen && addInfoTarget && (
          <AddInfoModal personName={(people.find(p => p.id === addInfoTarget.personId) || {}).name} category={addInfoTarget.category} onClose={closeAddInfo} onSave={handleAddInfoSave} />
        )}
        {addPersonOpen && <AddPersonModal onClose={() => setAddPersonOpen(false)} onSave={handleAddPerson} />}
        {editPersonOpen && selectedPerson && (
          <EditPersonModal person={selectedPerson} onClose={closeEditPerson}
            onSave={(vals) => handleSavePersonEdit(selectedPerson.id, vals)}
            onDelete={() => handleDeletePerson(selectedPerson.id, selectedPerson.name)} />
        )}
        {confirmState && (
          <ConfirmDialog title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={confirmState.onConfirm} onCancel={confirmState.onCancel} />
        )}
      </div>
    </div>
  );
}

// Named exports of pure logic, purely so they're unit-testable in isolation
// (see src/logic.test.js). None of this affects the default export/rendering.
export { clamp, computeOverall, layerForOverall, parseDaysAgo, summaryFor, homeGoalTitle, updateStatusText, getCheckInSuggestions, makePerson, generateSuggestions };

export default LayersApp;
