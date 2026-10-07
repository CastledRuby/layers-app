// Nicknames ("Also known as" on a profile): kept tidy, and a person is found
// by one wherever they're looked up by name: chat names (hidden before a chat
// is sent), Ctrl+K, and typed plans and logs.
import { describe, expect, it } from 'vitest';
import { analysisRequest, detectPeople, hideNames, namesOf, personNamed } from './lib/analysis.js';
import { validateBackup } from './lib/backup.js';
import { chatPeople } from './lib/chatImport.js';
import { jumpResults } from './lib/jump.js';
import { readSentence } from './lib/sentence.js';

const amelie = { id: 'a', name: 'Amelie', layer: 4, aka: ['Mel', 'Ames'] };
const people = [amelie, { id: 'c', name: 'Chloe', layer: 3 }, { id: 'm', name: 'Melissa', layer: 1 }];

describe('nicknames', () => {
  it('are kept as short text, each once, never the name itself', () => {
    const person = { id: 'a', name: 'Amelie', emoji: '🙂', layer: 2, overall: 10, aka: ['Mel', ' mel ', 'Amelie', 7, '', 'x'.repeat(60)] };
    const { data } = validateBackup({ version: 1, people: [person] });
    expect(data.people[0].aka).toEqual(['Mel', 'x'.repeat(40)]);
    expect(namesOf(amelie)).toEqual(['Amelie', 'Mel', 'Ames']);
  });

  it('find the person a chat is with', () => {
    expect(personNamed('Mel', people)).toBe(amelie);
    expect(personNamed('Ames 🌸', people)).toBe(amelie);
    expect(personNamed('Melissa', people).id).toBe('m'); // her own name, not a nickname's start
    expect(detectPeople('Mel: hi\nChloe: hey', people, 'Liam')).toEqual(['a', 'c']);
    const chat = { source: 'whatsapp', title: 'Mel', participants: ['Mel', 'Liam'], messages: [{ at: 1, sender: 'Mel', text: 'hi' }] };
    const { ids, nameFor } = chatPeople(chat, people, 'Liam');
    expect(ids).toEqual(['a']);
    expect(nameFor('Mel')).toBe('Amelie');
  });

  it('are hidden before a chat is sent', () => {
    expect(hideNames('Mel: hi Ames!', { names: [namesOf(amelie)], yourName: 'Liam' })).toBe('[them]: hi [them]!');
    const req = analysisRequest({ people: [amelie], yourName: 'Liam', text: 'Mel: hi Liam\nLiam: hey Ames' });
    expect(req.content.at(-1).text).toBe('The chat:\n\n[them]: hi [you]\n[you]: hey [them]');
  });

  it('find them in Ctrl+K and in typed plans', () => {
    const today = '2026-10-05';
    const now = new Date(2026, 9, 5, 15, 30);
    expect(jumpResults('ames', { people, today, now }).find(r => r.group === 'person')).toMatchObject({ label: 'Amelie' });
    expect(readSentence('coffee with mel fri 10am', { people, today, now })).toMatchObject({ personIds: ['a'], title: 'Coffee with Amelie' });
  });
});
