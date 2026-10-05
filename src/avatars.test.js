// The avatars (data/avatars.js): skin tones go in and come out of an emoji
// cleanly, so a toned avatar is found in its group again.
import { describe, expect, it } from 'vitest';
import { AVATAR_COLS, AVATAR_GROUPS, avatarName, groupOf, initialsOf, isInitials, splitTone, withTone } from './data/avatars.js';
import { createBackup, validateBackup } from './lib/backup.js';
import { makePerson } from './lib/progress.js';
import { PERSON_EMOJIS } from './data/constants.js';

const MEDIUM = '\u{1F3FD}';

describe('avatars', () => {
  it('has every avatar people already had, and full rows in each group', () => {
    const people = AVATAR_GROUPS[0].items.map(it => it.emoji);
    PERSON_EMOJIS.forEach(e => expect(people).toContain(e));
    AVATAR_GROUPS.forEach(g => expect(g.items.length % AVATAR_COLS).toBe(0));
    const all = AVATAR_GROUPS.flatMap(g => g.items.map(it => it.emoji));
    expect(new Set(all).size).toBe(all.length);
  });

  it('puts a skin tone after the first character, and takes it out again', () => {
    expect(withTone('👩', MEDIUM)).toBe('👩🏽');
    expect(withTone('👩‍🦰', MEDIUM)).toBe('👩🏽‍🦰');
    expect(withTone('👱‍♀️', MEDIUM)).toBe('👱🏽‍♀️');
    expect(withTone('🧑', '')).toBe('🧑');
    AVATAR_GROUPS[0].items.forEach(it => expect(splitTone(withTone(it.emoji, MEDIUM))).toEqual({ base: it.emoji, mod: MEDIUM }));
  });

  it('works out initials: first and last for two names or more, two letters for one', () => {
    expect(initialsOf('ethan m')).toBe('EM');
    expect(initialsOf('Mary Ann Lee')).toBe('ML');
    expect(initialsOf('isla')).toBe('Is');
    expect(initialsOf('Jo')).toBe('Jo');
    expect(initialsOf('J')).toBe('J');
    expect(initialsOf('  ')).toBe('?');
  });

  it('keeps initials through saving and backups, and drops anything it does not know', () => {
    const p = makePerson({ name: 'Sam', emoji: '🧑', avatar: { style: 'initials', color: 'teal' }, layer: 2 });
    expect(isInitials(p.avatar)).toBe(true);
    const odd = { ...makePerson({ name: 'Jo', emoji: '🧑', layer: 1 }), avatar: { style: 'photo', src: 'x' } };
    const { data } = validateBackup(createBackup({ people: [p, odd], journal: [], generalGoals: [], events: [], skills: {}, profile: { name: 'T', focus: null } }));
    expect(data.people[0].avatar).toEqual({ style: 'initials', color: 'teal' });
    expect('avatar' in data.people[1]).toBe(false);
    expect(data.people[1].emoji).toBe('🧑');
  });

  it('finds the group and the name of an avatar, toned or not', () => {
    expect(groupOf('🐶')).toBe(2);
    expect(groupOf(withTone('🧑‍🎓', MEDIUM))).toBe(0);
    expect(groupOf('🫠')).toBe(0); // not one of ours: People
    expect(avatarName(withTone('👩‍🦰', MEDIUM))).toBe('Woman, red hair, medium skin');
    expect(avatarName('🦊')).toBe('Fox');
  });
});
