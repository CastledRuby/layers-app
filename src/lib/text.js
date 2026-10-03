// Builds user-facing sentences: journal summaries, goal titles, profile
// suggestions, check-in names and reminder, coach hooks and updater status.

import { TYPE_META } from '../data/constants.js';
import { infoItemDateLabel, infoItemDaysAgo, journalDateLabel, journalDaysAgo, toISODate } from './dates.js';

export function summaryFor(entry) {
  if (entry.summary) return entry.summary;
  const meta = TYPE_META[entry.type] || TYPE_META.other;
  return entry.meaningfulness >= 4 ? meta.verbHigh : meta.verbLow;
}

export function updateStatusText(status) {
  if (!status) return 'Check whether a newer version is available.';
  switch (status.state) {
    case 'checking': return 'Checking for updates...';
    case 'up-to-date': return "You're on the latest version.";
    case 'available': return `Update v${status.version} found. Downloading...`;
    // The portable .exe can't update itself (main.cjs).
    case 'available-portable': return `Layers v${status.version} is out. This portable copy doesn't update itself: download the new one to replace it.`;
    case 'downloading': return `Downloading update... ${status.percent || 0}%`;
    case 'ready': return `Update v${status.version} downloaded and ready to install.`;
    case 'not-configured': return "Update checking isn't set up for this build yet.";
    case 'error': return `Couldn't check for updates${status.message ? ` (${status.message})` : ''}.`;
    default: return 'Check whether a newer version is available.';
  }
}

export function homeGoalTitle(goal, name) {
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

export function generateSuggestions(person, now = new Date()) {
  const candidates = [];
  person.plans.filter(i => !i.archived).forEach(it => { const d = infoItemDaysAgo(it, now); if (d >= 3) candidates.push({ d, headline: `You haven't asked about "${it.text}" in a while.`, body: "You could ask what's new with it, or how they're feeling about it." }); });
  person.important.filter(i => !i.archived).forEach(it => { const d = infoItemDaysAgo(it, now); if (d >= 3) candidates.push({ d, headline: `${person.name} mentioned "${it.text}" a little while ago.`, body: 'It might be worth asking how that went.' }); });
  person.experiences.filter(i => !i.archived).forEach(it => { const d = infoItemDaysAgo(it, now); if (d >= 7) candidates.push({ d, headline: `${person.name} once told you about "${it.text}".`, body: 'You could bring it up if it feels natural.' }); });
  person.interests.filter(i => !i.archived).forEach(it => { const d = infoItemDaysAgo(it, now); if (d >= 7) candidates.push({ d, headline: `${person.name} is into ${it.text}.`, body: 'Ask what got them into it, or bring it up next time you talk.' }); });
  candidates.sort((a, b) => b.d - a.d);
  return candidates.slice(0, 2);
}

export function getCheckInSuggestions(people, journal, now = new Date()) {
  const lastSeen = {};
  journal.forEach(j => {
    const d = journalDaysAgo(j, now);
    if (lastSeen[j.personId] === undefined || d < lastSeen[j.personId]) lastSeen[j.personId] = d;
  });
  return people.filter(p => lastSeen[p.id] !== undefined && lastSeen[p.id] >= 14).map(p => p.name);
}

// The daily "haven't checked in" notification: null if it already went out
// today (`lastNotified` is the local 'YYYY-MM-DD' it last fired) or nobody is
// overdue; otherwise the day to record and the text to show. Uses the local
// date, so "today" flips at local midnight, not UTC.
export function checkInReminder(people, journal, lastNotified, now = new Date()) {
  const day = toISODate(now);
  if (lastNotified === day) return null;
  const names = getCheckInSuggestions(people, journal, now);
  if (names.length === 0) return null;
  const list = names.slice(0, 2).join(' and ');
  const others = names.length - 2;
  const extra = others > 0 ? `, and ${others} other${others > 1 ? 's' : ''}` : '';
  return { day, body: `It's been a while since you checked in with ${list}${extra}.` };
}

export const HOOKS = [
  { key: 'activity', label: 'Activity', question: 'What got you into tennis?' },
  { key: 'experience', label: 'Experience', question: 'How has it been so far?' },
  { key: 'emotion', label: 'Emotion', question: 'Are you enjoying it?' },
  { key: 'future', label: 'Future', question: 'Would you ever want to play competitively?' },
  { key: 'opinion', label: 'Opinion', question: "What's the best part about it?" },
];

// Prepare's personal hooks, from everything saved about the person: their
// interests, plans, preferences, what's coming up for them, what you last
// talked about and what you noted afterwards. Social Penetration Theory
// moves from surface topics to personal ones as a relationship deepens, so
// experiences (personal history) are only suggested from Layer 3 on.
// Prompts, never scripts. Returns [] when nothing is saved yet, so Prepare
// never invents hooks.
export function buildPotentialHooks(person, journal, now = new Date()) {
  if (!person) return [];
  const active = (key) => (person[key] || []).filter(i => !i.archived)
    .slice().sort((a, b) => infoItemDaysAgo(a, now) - infoItemDaysAgo(b, now)); // most recently mentioned first
  const listOf = (items) => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  const hooks = [];

  const important = active('important');
  if (important.length > 0) {
    hooks.push({ key: 'followup', label: 'Ask how it went', text: `You noted "${important[0].text}" (${infoItemDateLabel(important[0], now)}). Asking how it went shows you remembered.` });
  }

  const recent = (journal || []).filter(j => j.personId === person.id).slice().sort((a, b) => journalDaysAgo(a, now) - journalDaysAgo(b, now));
  if (recent.length > 0) {
    const last = recent[0];
    const topics = [...new Set(recent.slice(0, 3).flatMap(j => j.added || []))].slice(0, 3);
    hooks.push({ key: 'recent', label: 'Last time you spoke', text: `${summaryFor(last)} (${journalDateLabel(last, now)})${topics.length ? `. You talked about ${listOf(topics)}` : ''}. A natural thing to circle back to.` });
    const reflected = recent.find(j => j.reflection);
    if (reflected) hooks.push({ key: 'reflection', label: 'What you noted afterwards', text: `"${reflected.reflection}"` });
  }

  const interests = active('interests');
  if (interests.length > 0) {
    const shown = interests.slice(0, 3).map(i => i.text);
    const more = interests.length - shown.length;
    hooks.push({ key: 'interest', label: 'Their interests', text: `They're into ${listOf(shown)}${more > 0 ? ` (and ${more} more)` : ''}. Notice an opening to bring one up rather than planning exactly what to say.` });
  }

  const plans = active('plans');
  if (plans.length > 0) {
    hooks.push({ key: 'plan', label: 'Something they mentioned', text: `They brought up "${plans[0].text}". Worth asking how it's going, or if it happened.` });
  }

  const preferences = active('preferences');
  if (preferences.length > 0) {
    hooks.push({ key: 'preference', label: 'Worth remembering', text: `${preferences[0].text}. Handy if you're suggesting something to do together.` });
  }

  const experiences = active('experiences');
  if (experiences.length > 0 && person.layer >= 3) {
    hooks.push({ key: 'experience', label: 'A deeper topic, if the moment is right', text: `They've shared "${experiences[0].text}". Only if they bring it up or the conversation is already personal.` });
  }

  return hooks.slice(0, 6);
}
