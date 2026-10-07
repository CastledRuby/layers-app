// Other calendars (lib/ics.js): reading what Google Calendar's secret iCal
// address gives, and listing its events between two days in this computer's
// time. They run in New Zealand time, like the laptop, wherever they run, so
// a time in Pacific/Auckland stays as it is and one in UTC moves.
import { describe, expect, it } from 'vitest';
import { calendarItems, parseCalendar } from './lib/ics.js';

process.env.TZ = 'Pacific/Auckland';

const cal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:School', ...events.flat(), 'END:VCALENDAR'].join('\r\n');
const ev = (lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
const items = (text, from = '2026-10-01', to = '2026-10-31') => calendarItems(parseCalendar(text), from, to);

describe('reading a calendar file', () => {
  it('finds its name and events, with folded lines and escaped text', () => {
    const parsed = parseCalendar(cal(ev(['UID:1', 'SUMMARY:Maths\\, room 4', 'DESCRIPTION:a long', '  line', 'DTSTART;TZID=Pacific/Auckland:20261007T101000', 'DTEND;TZID=Pacific/Auckland:20261007T111000'])));
    expect(parsed.name).toBe('School');
    expect(parsed.events[0]).toMatchObject({ uid: '1', title: 'Maths, room 4' });
  });

  it('a time in its zone, in UTC, or all day, in this computer’s time', () => {
    const list = items(cal(
      ev(['UID:a', 'SUMMARY:Mentor', 'DTSTART;TZID=Pacific/Auckland:20261007T104000', 'DTEND;TZID=Pacific/Auckland:20261007T114000']),
      ev(['UID:b', 'SUMMARY:Call', 'DTSTART:20261007T020000Z', 'DURATION:PT30M']),
      ev(['UID:c', 'SUMMARY:Teacher only day', 'DTSTART;VALUE=DATE:20261009', 'DTEND;VALUE=DATE:20261010']),
    ));
    expect(list.map(i => [i.title, i.date, i.time, i.duration])).toEqual([
      ['Mentor', '2026-10-07', 640, 60],
      ['Call', '2026-10-07', 900, 30], // 2:00 UTC is 3:00 PM in New Zealand's daylight time
      ['Teacher only day', '2026-10-09', null, null],
    ]);
  });
});

describe('repeating events', () => {
  it('weekly on chosen days, until a day, without the days taken out', () => {
    const list = items(cal(ev([
      'UID:r', 'SUMMARY:Maths', 'DTSTART;TZID=Pacific/Auckland:20261005T091000', 'DTEND;TZID=Pacific/Auckland:20261005T100000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261016T000000Z', 'EXDATE;TZID=Pacific/Auckland:20261009T091000',
    ])));
    // UNTIL is midnight UTC on the 16th, 1:00 PM in New Zealand, so Friday the 16th at 9:10 AM is in.
    expect(list.map(i => i.date)).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-16']);
    expect(list.every(i => i.time === 550 && i.duration === 50)).toBe(true);
  });

  it('daily with a count, and every other week', () => {
    expect(items(cal(ev(['UID:d', 'SUMMARY:Run', 'DTSTART;TZID=Pacific/Auckland:20261001T070000', 'RRULE:FREQ=DAILY;COUNT=3']))).map(i => i.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(items(cal(ev(['UID:w', 'SUMMARY:Club', 'DTSTART;TZID=Pacific/Auckland:20261002T180000', 'RRULE:FREQ=WEEKLY;INTERVAL=2']))).map(i => i.date)).toEqual(['2026-10-02', '2026-10-16', '2026-10-30']);
  });

  it('an occurrence moved or cancelled on its own', () => {
    const list = items(cal(
      ev(['UID:m', 'SUMMARY:Maths', 'DTSTART;TZID=Pacific/Auckland:20261005T091000', 'DURATION:PT50M', 'RRULE:FREQ=WEEKLY;COUNT=3']),
      ev(['UID:m', 'RECURRENCE-ID;TZID=Pacific/Auckland:20261012T091000', 'SUMMARY:Maths (moved)', 'DTSTART;TZID=Pacific/Auckland:20261013T140000', 'DURATION:PT50M']),
      ev(['UID:m', 'RECURRENCE-ID;TZID=Pacific/Auckland:20261019T091000', 'STATUS:CANCELLED', 'DTSTART;TZID=Pacific/Auckland:20261019T091000']),
    ));
    expect(list.map(i => [i.title, i.date, i.time])).toEqual([['Maths', '2026-10-05', 550], ['Maths (moved)', '2026-10-13', 840]]);
  });

  it('a cancelled event, and anything outside the days asked for, are left out', () => {
    const list = items(cal(
      ev(['UID:x', 'SUMMARY:Off', 'STATUS:CANCELLED', 'DTSTART;TZID=Pacific/Auckland:20261007T090000']),
      ev(['UID:y', 'SUMMARY:Later', 'DTSTART;TZID=Pacific/Auckland:20261207T090000']),
    ));
    expect(list).toEqual([]);
  });

  it('an all-day event over several days shows on each', () => {
    expect(items(cal(ev(['UID:h', 'SUMMARY:Holidays', 'DTSTART;VALUE=DATE:20261029', 'DTEND;VALUE=DATE:20261102'])), '2026-10-01', '2026-11-30').map(i => i.date)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
});
