// Builds user-facing sentences: journal summaries, goal titles, profile
// suggestions, check-in names and reminder, coach hooks and updater status.

import { TYPE_META } from '../data/constants.js';
import { infoItemDaysAgo, journalDateLabel, journalDaysAgo, toISODate } from './dates.js';

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

// #4: turns a person's saved interests + recent history into short noticing
// prompts for Prepare — never a script, always phrased as "worth asking"
// rather than "say this". Returns [] when there's nothing to draw from yet,
// so Prepare never invents hooks for a person with no saved information.
export function buildPotentialHooks(person, journal) {
  if (!person) return [];
  const hooks = [];
  const activeInterests = person.interests.filter(i => !i.archived);
  if (activeInterests.length > 0) {
    const extra = activeInterests.length - 1;
    hooks.push({ key: 'interest', label: 'Their interests', text: `They're into ${activeInterests[0].text}${extra > 0 ? ` (and ${extra} other thing${extra > 1 ? 's' : ''})` : ''} — worth noticing an opening to bring it up, not scripting exactly what to say.` });
  }
  const personJournal = (journal || []).filter(j => j.personId === person.id).slice().sort((a, b) => journalDaysAgo(a) - journalDaysAgo(b));
  if (personJournal.length > 0) {
    const last = personJournal[0];
    hooks.push({ key: 'recent', label: 'Last time you spoke', text: `${summaryFor(last)} (${journalDateLabel(last)}) — a natural thing to circle back to if it comes up again.` });
  }
  const activePlans = person.plans.filter(i => !i.archived);
  if (activePlans.length > 0) {
    hooks.push({ key: 'plan', label: 'Something they mentioned', text: `They brought up "${activePlans[0].text}" — worth asking how that went or if it happened.` });
  }
  const activeImportant = person.important.filter(i => !i.archived);
  if (activeImportant.length > 0) {
    hooks.push({ key: 'followup', label: 'Follow-up opportunity', text: `You noted "${activeImportant[0].text}" — a good thing to check in on.` });
  }
  return hooks.slice(0, 4);
}
