import { describe, expect, it } from 'vitest';
import { cleanList, toastXml } from '../electron/toasts.cjs';

describe('Windows toasts', () => {
  it("a reminder only snoozes (it hasn't happened yet, so no Log it or Done), as layers:// links, with text escaped", () => {
    const xml = toastXml({ kind: 'alert', title: 'Fish & chips <with> "Sam"', body: 'In 15 minutes', eventId: 'e1', day: '2026-10-04' });
    expect(xml).toContain('scenario="reminder"');
    expect(xml).toContain('launch="layers://open?e=e1&amp;d=2026-10-04"');
    expect(xml).toContain('<text>Fish &amp; chips &lt;with&gt; &quot;Sam&quot;</text>');
    expect(xml).not.toMatch(/Log it|Done/);
    expect(toastXml({ kind: 'snooze', title: 'Gym', body: '', eventId: 'e1', day: '2026-10-04' })).not.toMatch(/Log it|Done/);
    expect([...xml.matchAll(/arguments="([^"]+)"/g)].map(m => m[1])).toEqual([
      'layers://snooze?e=e1&amp;d=2026-10-04&amp;m=10',
      'layers://snooze?e=e1&amp;d=2026-10-04&amp;m=60',
      'layers://snooze?e=e1&amp;d=2026-10-04&amp;m=tomorrow',
    ]);
  });

  it('"How did it go?" is rated right there, or logged; summaries just open the day', () => {
    const after = toastXml({ kind: 'after', title: 'How did it go?', body: '', eventId: 'e1', day: '2026-10-04' });
    expect([...after.matchAll(/content="([^"]+)" activationType="protocol" arguments="([^"]+)"/g)].map(m => [m[1], m[2]])).toEqual([
      ['Casual', 'layers://rate?e=e1&amp;d=2026-10-04&amp;r=2'],
      ['Good', 'layers://rate?e=e1&amp;d=2026-10-04&amp;r=3'],
      ['Personal', 'layers://rate?e=e1&amp;d=2026-10-04&amp;r=4'],
      ['Deep', 'layers://rate?e=e1&amp;d=2026-10-04&amp;r=5'],
      ['Log it…', 'layers://log?e=e1&amp;d=2026-10-04'],
    ]);
    const morning = toastXml({ kind: 'morning', title: 'Today: 2 things', body: 'x', day: '2026-10-04' });
    expect(morning).not.toContain('<actions>');
    expect(morning).toContain('launch="layers://open?d=2026-10-04"');
  });

  it('a birthday coming up offers Plan something, with that person on that day', () => {
    const xml = toastXml({ kind: 'date', title: "🎂 Priya's birthday is in a week", body: '', personId: 'p1', day: '2026-10-05' });
    expect([...xml.matchAll(/arguments="([^"]+)"/g)].map(m => m[1])).toEqual(['layers://plan?d=2026-10-05&amp;p=p1']);
    expect(xml).toContain('content="Plan something"');
  });

  it('the catch-up list plans with each person, and it and the review open the week review', () => {
    const catchup = toastXml({ kind: 'catchup', title: 'Catch up', body: '', day: '2026-10-03', people: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }] });
    expect(catchup).toContain('launch="layers://review?d=2026-10-03"');
    expect([...catchup.matchAll(/content="([^"]+)"/g)].map(m => m[1])).toEqual(['Plan with Ana', 'Plan with Ben']);
    expect(toastXml({ kind: 'review', title: 'Your week', body: '', day: '2026-10-04' })).toMatch(/content="Review my week".*arguments="layers:\/\/review\?d=2026-10-04"/);
    expect(toastXml({ kind: 'quiet', title: 'x', body: '', personId: 'p', day: '2026-10-06' })).toContain('arguments="layers://plan?d=2026-10-06&amp;p=p"');
  });

  it('only schedules well-formed, future notifications', () => {
    const now = Date.now();
    const list = cleanList([
      { tag: 'ok', at: now + 60000, title: 'A', body: '', kind: 'morning', day: '2026-10-04' },
      { tag: 'past', at: now - 1000, title: 'B', body: '', kind: 'morning' },
      { tag: 'x'.repeat(65), at: now + 60000, title: 'C', body: '', kind: 'morning' },
      null,
    ], now);
    expect(list.map(n => n.tag)).toEqual(['ok']);
  });
});
