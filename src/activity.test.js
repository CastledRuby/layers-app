// The activity calendar (lib/activity.js) and the one-page summary
// (lib/summary.js).
import { describe, expect, it } from 'vitest';
import { activityGrid, activityLevel } from './lib/activity.js';
import { summaryFileName, summaryHtml } from './lib/summary.js';

const TODAY = '2026-10-07'; // a Wednesday
const log = (at, meaningfulness = 3, personId = 'p') => ({ id: `${at}${meaningfulness}${personId}`, personId, at, type: 'talked', meaningfulness, added: [], activeListening: [] });

describe('the activity calendar', () => {
  it('is 26 weeks of Monday to Sunday, ending with this week', () => {
    const grid = activityGrid([], TODAY);
    expect(grid.weeks).toHaveLength(26);
    expect(grid.weeks.every(w => w.length === 7)).toBe(true);
    expect(grid.weeks[25][0].day).toBe('2026-10-05'); // this Monday
    expect(grid.weeks[25][2].day).toBe(TODAY);
    expect(grid.weeks[25][3].future).toBe(true);
    expect(grid.weeks[0][0].day).toBe('2026-04-13');
    expect(grid.months[0]).toEqual({ col: 2, label: 'May' }); // April's label, two weeks before, would overlap it
  });

  it('shades a day by how many logs and how meaningful', () => {
    const grid = activityGrid([log('2026-10-06', 2), log('2026-10-07', 5), log('2026-10-07', 4), log('2026-01-01', 5)], TODAY);
    const day = (iso) => grid.weeks.flat().find(c => c.day === iso);
    expect(day('2026-10-06')).toMatchObject({ count: 1, level: 1 });
    expect(day('2026-10-07')).toMatchObject({ count: 2, score: 9, level: 3 });
    expect(grid.total).toBe(3); // the January one is before the grid
    expect([0, 1, 3, 4, 6, 7, 10, 11].map(activityLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('the one-page summary', () => {
  const person = { id: 'p', name: 'Sam <b>Lee</b>', emoji: '🧑', layer: 3, overall: 42, dims: { depth: 60, trust: 55 }, goals: [{ id: 'g', title: 'Spend more time together', progress: 30 }],
    interests: [{ id: 'i', emoji: '🎸', text: 'Plays guitar' }], preferences: [], plans: [], experiences: [], important: [{ id: 'x', text: 'Old', archived: true }],
    dates: [{ id: 'd', kind: 'birthday', date: '2008-03-14', yearly: true }], timeline: [{ label: 'First met', at: '2026-01-02' }] };

  it('has who they are, what you know, goals, dates and recent logs, with nothing taken as HTML', () => {
    const html = summaryHtml(person, { journal: [log('2026-10-06', 4)], today: TODAY });
    expect(html).toContain('Sam &lt;b&gt;Lee&lt;/b&gt;');
    expect(html).not.toContain('<b>Lee</b>');
    expect(html).toContain('Layer 3: Affective / Personal, 42% in');
    expect(html).toContain('Plays guitar');
    expect(html).not.toContain('Old'); // archived
    expect(html).toContain('Spend more time together');
    expect(html).toContain('14 March'); // a yearly date, without its year
    expect(html).toContain('First met');
    expect(html).toContain('1 log in the last six months');
    expect(html).not.toMatch(/<script/i);
  });

  it('names the file after them, without characters Windows refuses', () => {
    expect(summaryFileName({ name: 'Sam: "the man"/Lee?' }, TODAY)).toBe('Sam the manLee summary 7 October 2026.pdf');
  });
});
