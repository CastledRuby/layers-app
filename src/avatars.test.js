// The avatars (data/avatars.js): skin tones go in and come out of an emoji
// cleanly, so a toned avatar is found in its group again.
import { describe, expect, it } from 'vitest';
import { AVATAR_COLS, AVATAR_GROUPS, avatarName, cleanAvatar, groupOf, initialsOf, isInitials, photoBox, splitTone, withTone } from './data/avatars.js';
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

  it('keeps a photo only if it is a small picture held in the data', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(cleanAvatar({ style: 'photo', src: png })).toEqual({ style: 'photo', src: png });
    expect(cleanAvatar({ style: 'photo', src: 'https://example.com/me.png' })).toBeNull();
    expect(cleanAvatar({ style: 'photo', src: 'data:image/svg+xml;base64,PHN2Zz4=' })).toBeNull();
    expect(cleanAvatar({ style: 'photo', src: `data:image/jpeg;base64,${'A'.repeat(400000)}` })).toBeNull();
    expect(cleanAvatar({ style: 'initials', color: 'teal', extra: 1 })).toEqual({ style: 'initials', color: 'teal' });
  });

  it('places a picture so it always covers the circle', () => {
    // A wide 400 × 200 picture in a 100 px circle: as tall as the circle, centred.
    expect(photoBox(400, 200, { zoom: 1, x: 0, y: 0 }, 100)).toMatchObject({ left: -50, top: 0, width: 200, height: 100 });
    // It can't be moved further than its edge, up or down or sideways.
    expect(photoBox(400, 200, { zoom: 1, x: 5, y: 5 }, 100)).toMatchObject({ crop: { zoom: 1, x: 0.5, y: 0 }, left: 0, top: 0 });
    // Zooming in makes it bigger around the middle, and never below cover.
    expect(photoBox(400, 200, { zoom: 2 }, 100)).toMatchObject({ width: 400, height: 200, left: -150, top: -50 });
    expect(photoBox(400, 200, { zoom: 0.2 }, 100).crop.zoom).toBe(1);
  });

  it('finds the group and the name of an avatar, toned or not', () => {
    expect(groupOf('🐶')).toBe(2);
    expect(groupOf(withTone('🧑‍🎓', MEDIUM))).toBe(0);
    expect(groupOf('🫠')).toBe(0); // not one of ours: People
    expect(avatarName(withTone('👩‍🦰', MEDIUM))).toBe('Woman, red hair, medium skin');
    expect(avatarName('🦊')).toBe('Fox');
  });
});
