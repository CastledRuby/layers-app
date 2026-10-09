// More of reading calendar files (lib/ics.js; ics.test.js has the main
// cases): other time zones and daylight time, floating times, all-day events
// without an end or repeating, yearly and monthly repeats on days some years
// or months don't have, UNTIL as a day, several EXDATEs, a moved all-day
// occurrence, and what Google leaves out (no title, unfolded tabs, LF only).
// Pinned to New Zealand time, like the laptop.
import { describe, expect, it } from 'vitest';
import { calendarItems, parseCalendar } from './lib/ics.js';

process.env.TZ = 'Pacific/Auckland';

const cal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flat(), 'END:VCALENDAR'].join('\r\n');
const ev = (lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
const items = (text, from = '2026-10-01', to = '2026-10-31') => calendarItems(parseCalendar(text), from, to);
const when = (list) => list.map(i => [i.date, i.time]);

describe('time zones', () => {
  it("an event in another zone moves to New Zealand's day and time, across midnight", () => {
    // 6:00 PM in Los Angeles (PDT, UTC-7) is 1:00 AM UTC the next day, 2:00 PM in Auckland (NZDT, UTC+13).
    const list = items(cal(ev(['UID:la', 'SUMMARY:Call with LA', 'DTSTART;TZID=America/Los_Angeles:20261007T180000', 'DTEND;TZID=America/Los_Angeles:20261007T190000'])));
    expect(list.map(i => [i.title, i.date, i.time, i.duration])).toEqual([['Call with LA', '2026-10-08', 840, 60]]);
  });

  it("a weekly event keeps its own wall-clock time across its zone's daylight change, so it moves here", () => {
    // Fridays at 9:00 AM in Los Angeles: PDT until 1 November, then PST (an hour later in UTC).
    const list = items(cal(ev(['UID:w', 'SUMMARY:Standup', 'DTSTART;TZID=America/Los_Angeles:20261023T090000', 'DURATION:PT15M', 'RRULE:FREQ=WEEKLY;COUNT=3'])), '2026-10-01', '2026-11-30');
    expect(when(list)).toEqual([['2026-10-24', 300], ['2026-10-31', 300], ['2026-11-07', 360]]);
  });

  it("a weekly event in New Zealand's zone stays at its time across New Zealand's daylight change", () => {
    // Daylight time starts in New Zealand on 27 September 2026.
    const list = items(cal(ev(['UID:n', 'SUMMARY:Gym', 'DTSTART;TZID=Pacific/Auckland:20260920T090000', 'RRULE:FREQ=WEEKLY;COUNT=3'])), '2026-09-01', '2026-10-31');
    expect(when(list)).toEqual([['2026-09-20', 540], ['2026-09-27', 540], ['2026-10-04', 540]]);
  });

  it('a weekly event in UTC moves an hour here when New Zealand changes to daylight time', () => {
    const list = items(cal(ev(['UID:u', 'SUMMARY:Sync', 'DTSTART:20260920T200000Z', 'RRULE:FREQ=WEEKLY;COUNT=2'])), '2026-09-01', '2026-10-31');
    // 8:00 PM UTC is 8:00 AM the next day in NZST (UTC+12), 9:00 AM in NZDT (UTC+13).
    expect(when(list)).toEqual([['2026-09-21', 480], ['2026-09-28', 540]]);
  });

  it("a floating time, or a zone this computer doesn't know, is read as this computer's time", () => {
    const list = items(cal(
      ev(['UID:f', 'SUMMARY:Floating', 'DTSTART:20261007T083000']),
      ev(['UID:z', 'SUMMARY:Unknown zone', 'DTSTART;TZID=Mars/Olympus_Mons:20261008T100000']),
    ));
    expect(list.map(i => [i.title, i.date, i.time])).toEqual([['Floating', '2026-10-07', 510], ['Unknown zone', '2026-10-08', 600]]);
  });

  it('an EXDATE in UTC takes out the occurrence written in a zone', () => {
    const list = items(cal(ev([
      'UID:x', 'SUMMARY:Tutoring', 'DTSTART;TZID=Pacific/Auckland:20261005T160000', 'RRULE:FREQ=DAILY;COUNT=3', 'EXDATE:20261006T030000Z',
    ])));
    expect(list.map(i => i.date)).toEqual(['2026-10-05', '2026-10-07']);
  });
});

describe('all-day events', () => {
  it('without an end is one day; with a DURATION of days is that many', () => {
    const list = items(cal(
      ev(['UID:a', 'SUMMARY:Sports day', 'DTSTART;VALUE=DATE:20261012']),
      ev(['UID:b', 'SUMMARY:Camp', 'DTSTART;VALUE=DATE:20261020', 'DURATION:P3D']),
    ));
    expect(list.map(i => [i.title, i.date, i.time, i.allDay])).toEqual([
      ['Sports day', '2026-10-12', null, true],
      ['Camp', '2026-10-20', null, true], ['Camp', '2026-10-21', null, true], ['Camp', '2026-10-22', null, true],
    ]);
  });

  it('started before the days asked for, it shows on the days that are in them', () => {
    const list = items(cal(ev(['UID:h', 'SUMMARY:Holidays', 'DTSTART;VALUE=DATE:20260928', 'DTEND;VALUE=DATE:20261003'])));
    expect(list.map(i => i.date)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('a birthday every year from long ago shows this year, and an all-day weekly event skips its EXDATE days', () => {
    const list = items(cal(
      ev(['UID:bd', 'SUMMARY:Gran’s birthday', 'DTSTART;VALUE=DATE:19501014', 'DTEND;VALUE=DATE:19501015', 'RRULE:FREQ=YEARLY']),
      ev(['UID:bin', 'SUMMARY:Bins out', 'DTSTART;VALUE=DATE:20261001', 'RRULE:FREQ=WEEKLY', 'EXDATE;VALUE=DATE:20261008,20261022']),
    ));
    expect(list.map(i => [i.title, i.date])).toEqual([['Bins out', '2026-10-01'], ['Gran’s birthday', '2026-10-14'], ['Bins out', '2026-10-15'], ['Bins out', '2026-10-29']]);
  });

  it('one all-day occurrence moved to another day', () => {
    const list = items(cal(
      ev(['UID:m', 'SUMMARY:Market', 'DTSTART;VALUE=DATE:20261003', 'RRULE:FREQ=WEEKLY;COUNT=3']),
      ev(['UID:m', 'RECURRENCE-ID;VALUE=DATE:20261010', 'SUMMARY:Market (Sunday)', 'DTSTART;VALUE=DATE:20261011']),
    ));
    expect(list.map(i => [i.title, i.date])).toEqual([['Market', '2026-10-03'], ['Market (Sunday)', '2026-10-11'], ['Market', '2026-10-17']]);
  });
});

describe('repeats on days that some months or years lack', () => {
  it('monthly on the 31st skips the months without one', () => {
    const list = items(cal(ev(['UID:r', 'SUMMARY:Rent', 'DTSTART;TZID=Pacific/Auckland:20260731T090000', 'RRULE:FREQ=MONTHLY'])), '2026-07-01', '2026-12-31');
    expect(list.map(i => i.date)).toEqual(['2026-07-31', '2026-08-31', '2026-10-31', '2026-12-31']);
  });

  it('yearly on 29 February only in leap years', () => {
    const list = items(cal(ev(['UID:l', 'SUMMARY:Leap', 'DTSTART;VALUE=DATE:20240229', 'RRULE:FREQ=YEARLY'])), '2024-01-01', '2028-12-31');
    expect(list.map(i => i.date)).toEqual(['2024-02-29', '2028-02-29']);
  });

  it('UNTIL as a day includes that day; every other week on two days', () => {
    expect(items(cal(ev(['UID:d', 'SUMMARY:Swim', 'DTSTART;TZID=Pacific/Auckland:20261001T063000', 'RRULE:FREQ=DAILY;UNTIL=20261003']))).map(i => i.date))
      .toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(items(cal(ev(['UID:t', 'SUMMARY:Tennis', 'DTSTART;TZID=Pacific/Auckland:20261006T170000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH']))).map(i => i.date))
      .toEqual(['2026-10-06', '2026-10-08', '2026-10-20', '2026-10-22']);
  });
});

describe('monthly by weekday, and repeats it does not know', () => {
  // Google Calendar's "Monthly on the first Friday" is RRULE:FREQ=MONTHLY;BYDAY=1FR.
  it('monthly on the first Friday (BYDAY=1FR) lands on each first Friday', () => {
    const list = items(cal(ev(['UID:p', 'SUMMARY:Book club', 'DTSTART;TZID=Pacific/Auckland:20261002T190000', 'RRULE:FREQ=MONTHLY;BYDAY=1FR'])), '2026-10-01', '2026-12-31');
    expect(list.map(i => i.date)).toEqual(['2026-10-02', '2026-11-06', '2026-12-04']);
  });

  it('monthly on the last Friday (BYDAY=-1FR), with COUNT', () => {
    const list = items(cal(ev(['UID:l', 'SUMMARY:Drinks', 'DTSTART;TZID=Pacific/Auckland:20261030T170000', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR;COUNT=2'])), '2026-10-01', '2027-03-31');
    expect(list.map(i => i.date)).toEqual(['2026-10-30', '2026-11-27']);
  });

  it('an event repeating hourly still shows at least its first time', () => {
    const list = items(cal(ev(['UID:h', 'SUMMARY:Meds', 'DTSTART;TZID=Pacific/Auckland:20261007T080000', 'RRULE:FREQ=HOURLY;INTERVAL=12;COUNT=4'])));
    expect(list.map(i => [i.date, i.time])[0]).toEqual(['2026-10-07', 480]);
  });
});

describe("what's written loosely", () => {
  it('no title is Busy; LF-only lines and tab-folded lines are read; a location is kept', () => {
    const text = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:q', 'DTSTART;TZID=Pacific/Auckland:20261009T120000', 'LOCATION:Cafe\\, upstairs', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:r', 'SUMMARY:Lunch with', '\t Sam', 'DTSTART;TZID=Pacific/Auckland:20261010T120000', 'END:VEVENT', 'END:VCALENDAR'].join('\n');
    const list = items(text);
    expect(list.map(i => [i.title, i.date, i.location])).toEqual([['Busy', '2026-10-09', 'Cafe, upstairs'], ['Lunch with Sam', '2026-10-10', null]]);
  });

  it('an event without a start is skipped, and an empty file has nothing', () => {
    expect(items(cal(ev(['UID:n', 'SUMMARY:No start'])))).toEqual([]);
    expect(parseCalendar('')).toEqual({ name: null, events: [] });
    expect(items('')).toEqual([]);
  });
});
