// Static app vocabulary: layers, dimensions, info categories, goal presets,
// note templates, interaction types, achievements and onboarding focus options.

import { COLORS } from '../theme.js';

export const LAYERS = [
  { id: 1, name: 'Orientation', fullName: 'Orientation', color: COLORS.layer1, tint: COLORS.layer1Tint, deep: COLORS.layer1Deep, desc: 'Basic facts, introductions and small talk.' },
  { id: 2, name: 'Exploratory', fullName: 'Exploratory', color: COLORS.layer2, tint: COLORS.layer2Tint, deep: COLORS.layer2Deep, desc: 'Interests, opinions, hobbies and shared interests.' },
  { id: 3, name: 'Personal', fullName: 'Affective / Personal', color: COLORS.layer3, tint: COLORS.layer3Tint, deep: COLORS.layer3Deep, desc: 'Personal experiences, feelings, goals and meaningful moments.' },
  { id: 4, name: 'Close', fullName: 'Stable / Close', color: COLORS.layer4, tint: COLORS.layer4Tint, deep: COLORS.layer4Deep, desc: 'Strong trust, deeper understanding, vulnerability and mutual support.' },
];

export function getLayer(id) { return LAYERS.find(l => l.id === id) || LAYERS[0]; }

export const DIM_ORDER = ['depth', 'trust', 'reciprocity', 'interaction', 'sharedExperiences', 'listening'];

export const DIM_LABELS = { depth: 'Depth', trust: 'Trust', reciprocity: 'Reciprocity', interaction: 'Interaction', sharedExperiences: 'Shared experiences', listening: 'Listening / connection' };

export const DIM_COLORS = { depth: COLORS.layer3, trust: COLORS.layer4, reciprocity: COLORS.plum, interaction: COLORS.layer1, sharedExperiences: COLORS.teal, listening: COLORS.layer2 };

// Starting dimensions for someone added at each layer: 20% into its 25-point band.
export const LAYER_BASE_DIMS = { 1: 5, 2: 30, 3: 55, 4: 80 };

export const CATEGORIES = [
  { key: 'interests', label: 'Interests', placeholder: 'e.g. Loves rock climbing', emoji: '⭐' },
  { key: 'preferences', label: 'Preferences', placeholder: 'e.g. Prefers tea over coffee', emoji: '❤️' },
  { key: 'plans', label: 'Plans', placeholder: 'e.g. Wants to run a marathon', emoji: '🗓️' },
  { key: 'experiences', label: 'Experiences', placeholder: 'e.g. Changed schools last year', emoji: '🧭' },
  { key: 'important', label: 'Important / temporary', placeholder: 'e.g. Big exam next Tuesday', emoji: '🔔' },
];

export function categoryMeta(key) { return CATEGORIES.find(c => c.key === key) || CATEGORIES[0]; }

// The bottom tabs, in order: Today in the centre. Ctrl+1–5 follow it.
export const TABS = ['coach', 'people', 'today', 'journal', 'me'];

export const SHORTCUTS = [
  { keys: ['Ctrl', 'Shift', 'L'], desc: 'From anywhere in Windows: the quick-add box, to type a plan or a log without opening Layers' },
  { keys: ['Ctrl', 'Alt', 'L'], desc: 'From anywhere in Windows: bring Layers to the front, or send it back when it’s already there' },
  { keys: ['Ctrl', 'K'], desc: 'Jump to anything: a person, plan, page or action, or type a plan ("coffee w Priya fri 10am"; w is short for with) or a log ("log Sam deep")' },
  { keys: ['Ctrl', '1'], desc: 'Go to Coach' },
  { keys: ['Ctrl', '2'], desc: 'Go to People (the map of how close you are)' },
  { keys: ['Ctrl', '3'], desc: 'Go to Today (your day and the calendar)' },
  { keys: ['Ctrl', '4'], desc: 'Go to Journal' },
  { keys: ['Ctrl', '5'], desc: 'Go to Me' },
  { keys: ['N'], desc: 'Quick log an interaction' },
  { keys: ['P'], desc: 'Plan something on the calendar' },
  { keys: ['M'], desc: 'Today: switch between the day and the month' },
  { keys: ['←', '→'], or: true, desc: 'Today: the day before or after' },
  { keys: ['↑', '↓'], or: true, desc: 'Today: a week before or after' },
  { keys: ['↵'], desc: 'Today: open the day in a popup, with Coach tips for its plans (T)' },
  { keys: ['T'], desc: 'Today: back to today' },
  { keys: ['L', 'J', 'X'], or: true, desc: 'Today: Log it, Just tick it, or X if it didn’t happen (nothing logged), for the first "How did it go?"' },
  { keys: ['I'], desc: 'Today: plan the first idea' },
  { keys: ['W'], desc: 'Today: your week in review, then plan next week' },
  { keys: ['1–9'], desc: 'Picking people (log or plan): press their number, or type a name' },
  { keys: ['←', '→', 'Space'], desc: 'Picking people: move to anyone past the first nine, and pick them' },
  { keys: ['T', 'L', 'R', 'A'], or: true, desc: 'Planning "When?": step through time, length, repeat, reminder (1–7 picks the day)' },
  { keys: ['Shift', '↵'], desc: 'Planning: save and plan another straight away' },
  { keys: ['+'], desc: 'Planning "When?", or Goals when logging: a new goal with them' },
  { keys: ['Q', 'W', 'E', 'R'], or: true, desc: 'Planning "What?": plan one of your recent plans again' },
  { keys: ['C'], desc: 'An open plan: plan it again (a copy)' },
  { keys: ['X'], desc: 'An open plan that has started: it didn’t happen (nothing is logged)' },
  { keys: ['T'], desc: 'An open plan, or a plan in the day popup: Coach tips for it' },
  { keys: ['D'], desc: 'Add detail — browse templates and copy one, no logging needed' },
  { keys: ['Ctrl', 'Shift', 'A'], desc: 'Add a new person' },
  { keys: ['A'], desc: 'People: add a new person' },
  { keys: ['↑', '↓', '↵'], desc: 'People: move through the list, closest first, and open the one marked (beside a profile, ↑ ↓ open the next)' },
  { keys: ['←', '→', 'T', 'G', '/'], desc: 'Picking an avatar (out of the name box): arrows pick, T the skin tone, G the group, / find one by name. Photo: U chooses a picture, arrows move it, + and - zoom' },
  { keys: ['Shift', '↵'], desc: 'Setting up: add someone and ask how close you are (Q asks about the newest, A picks their avatar, D adds their birthday)' },
  { keys: ['1–7', 'S', 'C', 'V'], or: true, desc: 'A goal (Add goal, Edit): a relationship goal, the next skill goal, your own, or a more specific version; E the description, D a due date, ← → who it’s for' },
  { keys: ['←', '→', 'T'], or: true, desc: 'Add info on a profile: the icon, or mark it temporary (the details box is ready to type in)' },
  { keys: ['←', '→', 'L', 'A', 'O'], or: true, desc: 'Coach, Prepare: who you’re about to talk to, Log the conversation, Analyse a chat, Open their profile (1 and 2 switch Prepare and Analyse)' },
  { keys: ['/'], desc: 'Jump to search (People or Journal)' },
  { keys: ['Backspace'], desc: 'Go back from a person or goals screen' },
  { keys: ['Ctrl', 'Z'], desc: 'Undo what you just did, while its message shows (a delete, tick, log or saved plan)' },
  { keys: ['Ctrl', 'Y'], desc: 'Redo what you just undid, while "Undone" shows (Ctrl+Shift+Z too)' },
  { keys: ['N'], desc: 'In a log (and editing one), the note: type in it; Esc or Tab leaves it. Other text boxes show their letter the same way' },
  { keys: ['O', 'L', 'P', 'R', 'W'], or: true, desc: 'Ctrl+K, on a person after → or Tab: Open them, Log, Plan, Prepare to talk, or Where are you now' },
  { keys: ['Esc'], desc: 'Close the open sheet/dialog, or leave the search box or a text box you’re typing in (Tab too)' },
  { keys: ['?'], desc: 'Show this shortcuts list' },
];

export const EMOJI_CHOICES = ['⭐', '❤️', '🗓️', '🧭', '🔔', '🎮', '⚽', '🎵', '✈️', '📚', '☕', '🎨', '🎸', '🥾', '💼'];

export const PERSON_EMOJIS = ['🧑', '🧑‍🦱', '🧑‍🦰', '🧑‍🦳', '🧕', '🧔', '👩‍🦱', '👨‍🦲', '🧑‍🎓', '👩‍🦰'];

// Button-only "quick note" template library for logging (requested: tap
// through a category, then a specific item — no typing). Not a literal
// 1000 entries, but a genuinely large curated set across nine categories;
// tapping an item sets the note text directly.
export const NOTE_TEMPLATES = [
  { key: 'sports', label: 'Sports', emoji: '⚽', items: ['Football', 'Basketball', 'Tennis', 'Badminton', 'Hockey', 'Baseball', 'Cricket', 'Rugby', 'Volleyball', 'Swimming', 'Athletics', 'Golf', 'Table tennis', 'Boxing', 'Martial arts', 'Cycling', 'Running', 'Climbing', 'Skateboarding', 'Surfing', 'Skiing', 'Snowboarding', 'Gymnastics', 'Netball', 'Rowing', 'Wrestling', 'Lacrosse', 'Bowling', 'Darts', 'Fencing'] },
  { key: 'videogames', label: 'Video games', emoji: '🎮', items: ['Minecraft', 'Fortnite', 'Roblox', 'Call of Duty', 'FIFA', 'Valorant', 'League of Legends', 'Overwatch', 'Apex Legends', 'GTA', 'Zelda', 'Mario Kart', 'Animal Crossing', 'Pokémon', 'Among Us', 'Rocket League', 'The Sims', 'Counter-Strike', 'World of Warcraft', 'Genshin Impact'] },
  { key: 'boardgames', label: 'Board/tabletop games', emoji: '🎲', items: ['Chess', 'Monopoly', 'Catan', 'Uno', 'Dungeons & Dragons', 'Magic: The Gathering', 'Poker', 'Scrabble', 'Risk', 'Jenga', 'Cards Against Humanity'] },
  { key: 'music', label: 'Music', emoji: '🎵', items: ['Pop', 'Hip-hop', 'Rock', 'Rap', 'R&B', 'Country', 'EDM', 'Jazz', 'Classical', 'K-pop', 'Indie', 'Metal', 'Folk', 'Playing guitar', 'Playing piano', 'Playing drums', 'Singing', 'Songwriting', 'DJing'] },
  { key: 'movies', label: 'Movies', emoji: '🎬', items: ['Marvel/superhero films', 'Horror', 'Comedy', 'Sci-fi', 'Romance', 'Action', 'Anime films', 'Studio Ghibli', 'Documentaries', 'Thrillers', 'Classic films', 'Star Wars', 'A24 films'] },
  { key: 'shows', label: 'TV shows', emoji: '📺', items: ['Anime', 'Reality TV', 'True crime', 'Sitcoms', 'Sci-fi shows', 'K-dramas', 'Cartoons', 'Sports coverage', 'Cooking shows', 'Documentaries'] },
  { key: 'hobbies', label: 'Hobbies', emoji: '🎨', items: ['Drawing', 'Painting', 'Photography', 'Writing', 'Reading', 'Cooking', 'Baking', 'Gardening', 'Hiking', 'Fishing', 'Camping', 'Knitting/crochet', 'Woodworking', 'Dance', 'Yoga', 'Journaling', 'Collecting things', 'Cars', 'Fashion', 'Makeup'] },
  { key: 'school', label: 'School/work', emoji: '📚', items: ['Maths', 'Science', 'English', 'History', 'Art', 'Music class', 'PE', 'Computer science', 'Languages', 'Geography', 'Business', 'Psychology', 'A new job', 'A promotion', 'An exam', 'A project deadline'] },
  { key: 'clubs', label: 'Clubs/activities', emoji: '🧩', items: ['Debate team', 'Drama club', 'Student council', 'Choir/band', 'Scouts', 'Volunteering', 'Part-time job', 'Church/faith group', 'Gym', 'Book club'] },
  { key: 'life', label: 'Life stuff', emoji: '🌱', items: ['Family', 'A pet', 'Moving house', 'A trip/holiday', 'A relationship', 'Feeling stressed', 'Feeling excited', 'A health thing', 'A celebration', 'A tough week'] },
];

// Where a topic picked with "+ Add detail" while logging is saved on the
// person's profile (only when the log is with one person; a group log keeps
// topics in its note). Hobby-type topics are interests; school/work and life
// topics ("An exam", "Moving house") are temporary "Important" items, which
// Prepare turns into "ask how it went". Custom text stays in the note only.
export const NOTE_TEMPLATE_CATEGORY = {
  sports: 'interests', videogames: 'interests', boardgames: 'interests', music: 'interests',
  movies: 'interests', shows: 'interests', hobbies: 'interests', clubs: 'interests',
  school: 'important', life: 'important',
};

// Tap-to-add suggestions for "Something new about …?" while logging, so most
// things need no typing. Interests use the topic lists above (NOTE_TEMPLATES
// groups filed as interests); the other categories use these.
export const INFO_TEMPLATES = {
  preferences: ['Prefers texting', 'Prefers calls', 'Prefers one-on-one', 'Likes groups', 'Likes quiet places', 'Likes busy places', 'Night owl', 'Not a morning person', 'Loves coffee', 'Prefers tea', 'Vegetarian', "Doesn't drink", 'Likes being active', 'Likes staying in', 'Likes plans made ahead', 'Likes spontaneous plans'],
  plans: ['Going on holiday', 'Planning a trip', 'Starting a new job', 'Looking for work', 'Moving house', 'Exams coming up', 'Learning to drive', 'Saving up for something', 'Starting a course', 'Training for an event', 'Birthday coming up', 'Going to a concert', 'Wants to learn something new'],
  experiences: ['Travelled overseas', 'Changed schools', 'Moved cities', 'Changed jobs', 'Got a new pet', 'Lost a pet', 'Went through a breakup', 'Started a relationship', 'Had a tough time lately', 'Achieved something big', 'Recovered from being ill', 'Family changes', 'Tried something new'],
  important: ['Exam soon', 'Job interview soon', 'Feeling unwell', 'Stressed lately', 'Family going through something', 'Busy week', 'Birthday soon', 'Going away soon', 'Big game or performance soon', 'Waiting on news', 'Celebrating something'],
};

// Coach tips for a plan, by its template (lib/tips.js adds what's saved
// about the people). Prompts for what to try, never scripts.
export const PLAN_TIPS = {
  coffee: [
    'Pick somewhere quiet enough to hear each other.',
    'Have one thing ready to ask about, then follow where it goes.',
    'Leave while it’s still good; it makes the next one easy to suggest.',
  ],
  call: [
    'Check it’s still a good time before diving in.',
    'Open with something specific rather than “what’s up?”.',
    'End with something to look forward to: a plan, or a follow-up.',
  ],
  hangout: [
    'Doing something side by side takes the pressure off talking the whole time.',
    'Notice what they light up about; that’s your next plan.',
    'Before you leave, suggest the next time.',
  ],
  meal: [
    'Let them pick the place if they have a favourite.',
    'Phones away: the easiest way to show you’re listening.',
    'Ask about the best part of their week, then share yours.',
  ],
  activity: [
    'Keep it light if it’s competitive; the point is time together.',
    'The quiet moments in between are where the good conversations happen.',
    'Afterwards, mention a moment you enjoyed.',
  ],
  study: [
    'Agree on breaks, and use them to chat.',
    'Ask what they’re finding hardest, and offer to go through it together.',
    'Celebrate a small win together at the end.',
  ],
  checkin: [
    'Mention something specific you remembered about them.',
    'Keep it short and easy to reply to.',
    'Ask an open question rather than a yes-or-no one.',
  ],
  custom: [
    'Have one thing ready to ask about.',
    'Listen for a detail to follow up on next time.',
    'Before you go, suggest the next time.',
  ],
};

// Tap-to-add phrases for "How did it feel?": how it went, and what to try
// next time. The picked ones become the reflection, with anything typed after.
export const REFLECTION_TEMPLATES = {
  went: ['Easy and natural', 'We laughed a lot', 'Went deeper than usual', 'They opened up', 'I opened up', 'Felt energising', 'A bit awkward at first', 'Felt rushed', 'Ran out of things to say', 'Felt draining'],
  next: ['Ask more questions', 'Listen more, talk less', 'Share more about me', 'Follow up on what they said', 'Plan something together', 'Check in sooner', 'Keep it lighter'],
};

// The log's More details rates each dimension 1-5 with these questions
// (keyboard: type a number per row). A rating drives that dimension's growth
// instead of the overall "How meaningful" score (lib/progress.js dimBumps).
export const DIM_QUESTIONS = {
  depth: 'How deep did it go?',
  trust: 'How much trust was there?',
  reciprocity: 'How reciprocal was it?',
  interaction: 'How engaged were you both?',
  sharedExperiences: 'How much of an experience did you share?',
  listening: 'How well did you listen to each other?',
};

// Relationship goals that are about one dimension move with that
// dimension's rating when it's given (otherwise with "How meaningful").
export const GOAL_PRESET_DIM = {
  becomeCloser: 'trust', deeper: 'depth', learn: 'listening', shared: 'sharedExperiences',
  together: 'sharedExperiences', maintain: 'interaction', comfortable1on1: 'interaction',
};

// Journal entries logged with 1.0.28 builds before the ratings carry
// "What stood out?" picks; kept so those entries still show them.
export const STANDOUTS = [
  { key: 'depth', label: 'Went deeper' },
  { key: 'trust', label: 'Felt trusted' },
  { key: 'reciprocity', label: 'Good back-and-forth' },
  { key: 'sharedExperiences', label: 'Did something together' },
  { key: 'listening', label: 'Really listened' },
];

export const PRESETS = [
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

export function presetMeta(key) { return PRESETS.find(p => p.key === key); }

// Specific variants for each preset goal, shown when you drill into one via
// its ">" chevron. Each variant is just a more concrete version of the same
// goal — picking one sets it as the description directly.
export const PRESET_VARIANTS = {
  becomeCloser: ['Hang out one-on-one without a specific reason', 'Do something low-pressure together weekly', 'Send a message just because they crossed your mind', 'Invite them somewhere before they invite you', 'Learn one new thing about them each time you talk', 'Make plans further out than "let\u2019s hang out sometime"'],
  deeper: ['Ask about something they care about, not just events in their life', 'Share something a bit more personal before asking a personal question back', 'Talk through a challenge either of you is facing', 'Ask what\u2019s been on their mind lately', 'Bring up something meaningful instead of just catching up', 'Ask a "why" question instead of just a "what" question'],
  learn: ['Learn what they\u2019re currently into', 'Learn about their family or background', 'Learn what a hard week looks like for them', 'Learn what they\u2019re proud of right now', 'Learn how they like to spend a free weekend', 'Learn what they\u2019re worried about lately'],
  shared: ['Find a hobby you could actually do together', 'Find a show, game, or artist you both like', 'Find something you disagree about and talk it through', 'Find a place you\u2019d both want to go', 'Find a food or restaurant you both love', 'Find something you\u2019re both bad at and laugh about it'],
  together: ['Plan one specific hangout with a real date/time', 'Invite them to something you\u2019re already doing', 'Try a new activity neither of you has done before', 'Go somewhere neither of you has been', 'Cook or make something together', 'Do a small favor for them without being asked'],
  maintain: ['Check in every 2 weeks, even briefly', 'Remember and follow up on something they mentioned', 'Reach out first at least once this month', 'Send something that reminded you of them', 'Celebrate something good that happened to them', 'Keep a light conversation going, not just big catch-ups'],
  comfortable1on1: ['Suggest a walk or low-pressure activity, just the two of you', 'Have one call or voice chat, not just text', 'Sit with a silence instead of rushing to fill it', 'Ask them something you\u2019ve been curious about', 'Spend time together with no particular plan', 'Share a small worry and see how it goes'],
  followUpQ: ['Ask about something they mentioned in passing last time', 'Ask "what was that like?" instead of just "that\u2019s cool"', 'Follow up on something from a previous conversation', 'Ask how something turned out that they were nervous about', 'Ask what happened next, instead of moving on', 'Circle back to something they said mattered to them'],
  fewerQuestions: ['Share something before asking your next question', 'Let a silence sit instead of filling it with a question', 'Match their pace \u2014 one question per one thing you share', 'Make a statement instead of turning everything into a question', 'Let them lead the topic for a while', 'Notice if you\u2019re interviewing instead of talking'],
  selfDisclosureGoal: ['Share something you\u2019re genuinely excited about', 'Share something you\u2019re a little nervous or unsure about', 'Share a story, not just a fact about yourself', 'Share an opinion instead of staying neutral', 'Tell them something you haven\u2019t told many people', 'Share how you\u2019re actually doing, not just "fine"'],
  activeListeningGoal: ['Paraphrase what they said before responding', 'Ask a follow-up before changing the subject', 'Notice and name the emotion behind what they\u2019re saying', 'Put your phone away for the whole conversation', 'Let them finish before you start forming your reply', 'Ask what they mean instead of assuming'],
  readCues: ['Notice when their energy shifts mid-conversation', 'Notice response length/timing, not just their words', 'Check in if something seems off, instead of pushing on', 'Notice when they change the subject and why', 'Notice their tone, not just what they say', 'Pick up on when a topic feels sensitive'],
  reciprocal: ['Match their depth \u2014 if they go personal, you go personal too', 'Share something before they have to ask', 'Notice if you\u2019re always the one asking, not sharing', 'Offer support the way you\u2019d want it offered to you', 'Check you\u2019re not always the one reaching out first', 'Give as much as you\u2019re asking for in the conversation'],
  recognizeSpace: ['Notice short replies as a possible signal to ease off', 'Ask if now\u2019s a good time before diving into something heavy', 'Give them an easy out if they seem tired or distracted', 'Don\u2019t push for details if they change the subject', 'Notice when they need space instead of company', 'Respect a slow reply instead of following up right away'],
};

// For relationship-category goals, the auto-filled description now reflects
// where this specific relationship actually stands (current layer, weakest
// dimension) rather than always showing the same static hint regardless of
// progress. Skill/custom goals aren't tied to one relationship, so they keep
// the plain hint.
export const GOAL_DIM_PHRASES = { depth: 'depth', trust: 'trust', reciprocity: 'reciprocity', interaction: 'how often you connect', sharedExperiences: 'shared experiences', listening: 'active listening' };

export const TYPE_META = {
  talked: { emoji: '💬', label: 'Talked', verbHigh: 'Had a meaningful conversation', verbLow: 'Talked for a bit' },
  activity: { emoji: '🎮', label: 'Did an activity', verbHigh: 'Had a great time doing an activity together', verbLow: 'Did an activity together' },
  messaged: { emoji: '📱', label: 'Messaged', verbHigh: 'Had a good exchange of messages', verbLow: 'Exchanged messages' },
  hangout: { emoji: '🍕', label: 'Hung out', verbHigh: 'Had a really good hangout', verbLow: 'Hung out together' },
  called: { emoji: '📞', label: 'Called', verbHigh: 'Had a meaningful call', verbLow: 'Had a call' },
  other: { emoji: '✏️', label: 'Other', verbHigh: 'Logged a meaningful interaction', verbLow: 'Logged an interaction' },
  analysed: { emoji: '📸', label: 'Analysed', verbHigh: 'Had an engaged conversation', verbLow: 'Reviewed a conversation' },
};

export const TYPE_ORDER = ['talked', 'activity', 'messaged', 'hangout', 'called', 'other'];

export const AL_ITEMS = [
  { key: 'followup', label: 'Asked follow-up questions' },
  { key: 'paraphrase', label: 'Paraphrased or clarified' },
  { key: 'listened', label: 'Let them speak without interrupting' },
  { key: 'remembered', label: 'Remembered something they previously mentioned' },
];

export const CONV_STATES = {
  engaged: { emoji: '🟢', label: 'Engaged', desc: 'They are contributing, asking questions and introducing topics.' },
  lowEnergy: { emoji: '🟡', label: 'Low energy but engaged', desc: 'Shorter responses, but they continue participating.' },
  listening: { emoji: '🟡', label: 'Listening mode', desc: "They seem happy to hear your stories but aren't introducing many topics." },
  unclear: { emoji: '🟠', label: 'Unclear', desc: 'Not enough evidence to tell yet.' },
  windingDown: { emoji: '🔴', label: 'Likely wants to finish', desc: 'Repeated short responses or signs they may be tired or busy.' },
};

// Skill goals (Goals > "My skills" presets) move when their skill does:
// each log or analysis that raises the skill adds SKILL_GOAL_STEP to them.
// (They used to move only with "Mark progress".)
export const SKILL_GOAL_PRESETS = {
  followUpQ: 'followUp', fewerQuestions: 'reciprocity', selfDisclosureGoal: 'selfDisclosure',
  activeListeningGoal: 'activeListening', readCues: 'readingCues', reciprocal: 'reciprocity', recognizeSpace: 'knowingWhenToStop',
};
export const SKILL_GOAL_STEP = 20;

export const ACHIEVEMENTS = [
  { key: 'firstMeaningful', emoji: '🏅', title: 'First Meaningful Conversation', desc: 'Log a conversation rated Personal or Deep.' },
  { key: 'activeListener', emoji: '🎧', title: 'Active Listener', desc: 'Practise active listening in 5 or more conversations.' },
  { key: 'remembered10', emoji: '🧠', title: 'Remembered 10 Things', desc: 'Save 10 pieces of information across your relationships.' },
  { key: 'reciprocityMaster', emoji: '🔄', title: 'Master of Reciprocity', desc: 'Reach 75% in your reciprocity skill.' },
  { key: 'relationshipBuilder', emoji: '🌱', title: 'Relationship Builder', desc: 'Grow two relationships into the Personal layer or closer.' },
];

export const SKILL_ORDER = ['activeListening', 'followUp', 'reciprocity', 'selfDisclosure', 'readingCues', 'knowingWhenToStop'];

export const FOCUS_SKILL_KEY = 'reciprocity';
// The Me tab's "Your biggest strength" is your highest skill and "Current
// focus" your lowest, each with its own tip and challenge. (Both used to be
// fixed, so a brand-new user was told they "ask strong follow-up questions".)
export const SKILL_TIPS = {
  activeListening: { emoji: '🎧', focus: 'Listening well is the base of every good conversation: let people finish, and show you heard them.', challenge: 'In your next 3 conversations, put what they said into your own words once before you reply.' },
  followUp: { emoji: '❓', focus: 'A good follow-up question shows you were listening and makes people feel interesting.', challenge: 'In your next 3 conversations, pick one detail they mention and ask about that detail specifically.' },
  reciprocity: { emoji: '🔄', focus: 'Conversations feel balanced when you share about as much as you ask.', challenge: 'In your next 3 conversations, when someone says something you can relate to, share your own experience before asking another question.' },
  selfDisclosure: { emoji: '💫', focus: 'Sharing a little about yourself helps people feel they know you, and invites them to share back.', challenge: "In your next 3 conversations, share one thing you're genuinely excited or unsure about." },
  readingCues: { emoji: '👀', focus: 'Noticing energy, reply length and tone tells you when to go deeper and when to ease off.', challenge: 'In your next 5 conversations, notice one moment their energy changed, and what changed it.' },
  knowingWhenToStop: { emoji: '🌤️', focus: 'Ending on a good note leaves people looking forward to the next conversation.', challenge: "In your next 3 conversations, wrap up while it's still going well, and mention when you'll talk next." },
};

export const FOCUS_OPTIONS = [
  { key: 'new', label: 'Building new friendships' },
  { key: 'deepen', label: 'Deepening close relationships' },
  { key: 'skills', label: 'My own social skills' },
  { key: 'mix', label: 'A bit of everything' },
];

export const FOCUS_LABELS = { new: 'building new friendships', deepen: 'deepening close relationships', skills: 'your own social skills', mix: 'a bit of everything' };
