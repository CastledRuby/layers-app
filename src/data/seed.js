// Example people, goals, journal and skills loaded by "Explore with example
// people" and "Restore sample data".


// Seed info items and timeline steps carry legacy `updated` / `date` labels
// instead of `at`: backfillPeopleDates resolves them whenever the sample is
// loaded, so 'Today' is the day it's loaded.
export const INITIAL_PEOPLE = [
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

export const INITIAL_GENERAL_GOALS = [
  { id: 'gen-goal-1', personId: null, category: 'skill', type: 'activeListeningGoal', title: 'Improve active listening', description: 'Use better follow-ups in 5 conversations', progress: 64, history: [{ date: 'Aug 20', value: 40 }, { date: 'Aug 28', value: 52 }, { date: 'Sep 3', value: 64 }] },
];

// Seed entries carry `date` labels instead of `at`: backfillJournalDates
// resolves them whenever the sample is loaded, so 'Today' is the day it's
// loaded and 'Aug 31' matches the seed chart histories' absolute dates.
export const INITIAL_JOURNAL = [
  { id: 'j1', personId: 'alex', date: 'Today', type: 'talked', meaningfulness: 4, added: ['Interested in F1'], activeListening: ['followup', 'remembered'], summary: 'Had a meaningful conversation' },
  { id: 'j2', personId: 'jamie', date: 'Yesterday', type: 'activity', meaningfulness: 3, added: [], activeListening: [], summary: 'Played Xbox together' },
  { id: 'j3', personId: 'alex', date: 'Aug 31', type: 'talked', meaningfulness: 3, added: [], activeListening: ['listened'], summary: 'Talked about future plans' },
  { id: 'j4', personId: 'priya', date: 'Aug 30', type: 'talked', meaningfulness: 5, added: ['Moved cities two years ago'], activeListening: ['paraphrase', 'followup'] },
  { id: 'j5', personId: 'noah', date: 'Aug 29', type: 'hangout', meaningfulness: 3, added: [], activeListening: [] },
  { id: 'j6', personId: 'sam', date: 'Aug 28', type: 'messaged', meaningfulness: 2, added: [], activeListening: [] },
  { id: 'j7', personId: 'jamie', date: 'Aug 27', type: 'called', meaningfulness: 3, added: [], activeListening: ['remembered'] },
];

export const INITIAL_SKILLS = {
  activeListening: { label: 'Active listening', current: 82, history: [{ date: 'Sep', value: 64 }, { date: 'Oct', value: 70 }, { date: 'Nov', value: 75 }, { date: 'Dec', value: 79 }, { date: 'Jan', value: 82 }] },
  followUp: { label: 'Follow-up questions', current: 74, history: [{ date: 'Sep', value: 58 }, { date: 'Oct', value: 63 }, { date: 'Nov', value: 68 }, { date: 'Dec', value: 71 }, { date: 'Jan', value: 74 }] },
  reciprocity: { label: 'Reciprocity', current: 69, history: [{ date: 'Sep', value: 52 }, { date: 'Oct', value: 58 }, { date: 'Nov', value: 62 }, { date: 'Dec', value: 66 }, { date: 'Jan', value: 69 }] },
  selfDisclosure: { label: 'Self-disclosure', current: 61, history: [{ date: 'Sep', value: 48 }, { date: 'Oct', value: 52 }, { date: 'Nov', value: 55 }, { date: 'Dec', value: 58 }, { date: 'Jan', value: 61 }] },
  readingCues: { label: 'Reading conversational cues', current: 68, history: [{ date: 'Sep', value: 53 }, { date: 'Oct', value: 58 }, { date: 'Nov', value: 62 }, { date: 'Dec', value: 65 }, { date: 'Jan', value: 68 }] },
  knowingWhenToStop: { label: 'Knowing when to stop', current: 77, history: [{ date: 'Sep', value: 60 }, { date: 'Oct', value: 66 }, { date: 'Nov', value: 71 }, { date: 'Dec', value: 74 }, { date: 'Jan', value: 77 }] },
};

export const EMPTY_SKILLS = {
  activeListening: { label: 'Active listening', current: 0, history: [] },
  followUp: { label: 'Follow-up questions', current: 0, history: [] },
  reciprocity: { label: 'Reciprocity', current: 0, history: [] },
  selfDisclosure: { label: 'Self-disclosure', current: 0, history: [] },
  readingCues: { label: 'Reading conversational cues', current: 0, history: [] },
  knowingWhenToStop: { label: 'Knowing when to stop', current: 0, history: [] },
};
