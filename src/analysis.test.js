// Real conversation analysis, the page's half (lib/analysis.js): who a chat
// is with, names kept out of pasted text and put back into the answer, what
// Claude is asked, and an answer (with its log) made safe whatever comes back.
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './data/constants.js';
import { MODELS } from '../electron/analysis.cjs';
import { ANALYSIS_MODELS, ANALYSIS_SCHEMA, analysisCost, analysisRequest, analysisResult, analysisSchema, analysisSystem, chatSpeakers, DEFAULT_ANALYSIS_MODEL, detectPeople, hideNames, restoreNames, typicalCost } from './lib/analysis.js';

const priya = { id: 'p1', name: 'Priya Shah', layer: 2 };
const amelie = { id: 'a', name: 'Amelie', layer: 4, interests: [{ text: 'Reading' }] };
const chloe = { id: 'c', name: 'Chloe', layer: 3 };
const TODAY = new Date(2026, 9, 7); // Wednesday 7 October 2026

describe('who a chat is with', () => {
  it('reads the names messages are signed with, plain or with WhatsApp times', () => {
    const chat = [
      'Amelie: hey!',
      '[6/10/26, 9:41:03 pm] Liam: hi',
      '6/10/26, 9:42 pm - Chloe 🌸: hello both',
      'Amelie: meet at 10:30?',
      'a line with no name',
      'Note this: https://example.com',
    ].join('\n');
    expect(chatSpeakers(chat)).toEqual(['Amelie', 'Liam', 'Chloe', 'Note this']);
  });

  it('matches them to your people (full name, or a first name only one person has), leaving you out', () => {
    const people = [amelie, chloe, { id: 'x1', name: 'Alex', layer: 1 }, { id: 'x2', name: 'Alexa', layer: 2 }, { id: 's1', name: 'Sam Lee', layer: 1 }, { id: 's2', name: 'Sam Wu', layer: 1 }];
    expect(detectPeople('Amelie: hi\nLiam: yo\nAmelie: so', people, 'Liam')).toEqual(['a']);
    expect(detectPeople('Chloe R: hi\nAmelie: hey\nYou: hello', people, 'Liam')).toEqual(['c', 'a']);
    expect(detectPeople('Alex: hi\nAlexa: hey', people, '')).toEqual(['x1', 'x2']);
    expect(detectPeople('Sam: hi', people, '')).toEqual([]); // two Sams: it can't tell
    expect(detectPeople('Sam Wu: hi', people, '')).toEqual(['s2']);
    expect(detectPeople('Jess: hi\njust text', people, '')).toEqual([]);
  });
});

describe('names', () => {
  it('hides their name and yours in pasted text, whole words only', () => {
    const chat = 'Priya: hey Sam!\nSam: hi priya, how was Priya Shah day?\nPriyanka says hi to Sam\'s mum';
    expect(hideNames(chat, { theirName: 'Priya Shah', yourName: 'Sam' }))
      .toBe("[them]: hey [you]!\n[you]: hi [them], how was [them] day?\nPriyanka says hi to [you]'s mum");
  });

  it('copes with accents, symbols in names, and no names at all', () => {
    expect(hideNames('Zoë said hi, zoë!', { theirName: 'Zoë', yourName: '' })).toBe('[them] said hi, [them]!');
    expect(hideNames('Is A+ here? A+ is.', { theirName: 'A+', yourName: '' })).toBe('Is [them] here? [them] is.');
    expect(hideNames('nothing to hide', { theirName: '', yourName: '' })).toBe('nothing to hide');
  });

  it('numbers everyone in a group chat, and puts each first name back', () => {
    expect(hideNames('Amelie: hi Chloe\nChloe: hey Amelie and Liam', { names: ['Amelie', 'Chloe'], yourName: 'Liam' }))
      .toBe('[them 1]: hi [them 2]\n[them 2]: hey [them 1] and [you]');
    expect(restoreNames(['[them 2] asked [them 1]', '[them] and [you]'], ['Amelie R', 'Chloe'])).toEqual(['Chloe asked Amelie', 'them and you']);
  });

  it('puts their first name back throughout the answer, and "you" for you', () => {
    expect(restoreNames({ a: ['[them] liked it', { b: '[You] asked [THEM]' }], n: 3 }, 'Priya Shah'))
      .toEqual({ a: ['Priya liked it', { b: 'you asked Priya' }], n: 3 });
  });
});

describe('the request', () => {
  it('sends the screenshots, then the pasted chat with names hidden', () => {
    const images = [{ mediaType: 'image/jpeg', data: 'AAA' }];
    const req = analysisRequest({ person: priya, yourName: 'Sam', text: '  Priya: hi Sam  ', images, today: TODAY });
    expect(req.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' } },
      { type: 'text', text: 'The chat:\n\n[them]: hi [you]' },
    ]);
    expect(req.system).toMatch(/Layer 2/);
    expect(req.system).not.toMatch(/Priya|Sam/);
    expect(req.schema).toEqual(ANALYSIS_SCHEMA);
  });

  it('for a group: each person tagged with their layer, and saying whose each detail is', () => {
    const req = analysisRequest({ people: [amelie, chloe], yourName: 'Liam', text: 'Amelie: hi\nChloe: hey', today: TODAY });
    expect(req.content.at(-1).text).toBe('The chat:\n\n[them 1]: hi\n[them 2]: hey');
    expect(req.system).toMatch(/\[them 1\], in Layer 4.*\[them 2\], in Layer 3/s);
    expect(req.schema.properties.transcript.items.properties.who.enum).toEqual(['you', 'them 1', 'them 2']);
    expect(req.schema.properties.extractedInfo.items.properties.about.enum).toEqual(['them 1', 'them 2']);
    expect(ANALYSIS_SCHEMA.properties.extractedInfo.items.properties).not.toHaveProperty('about');
  });

  it("tells Claude what to look for and how to score, today's date for the chat's times, and the log's own scales", () => {
    const system = analysisSystem({ layers: [3], today: TODAY, dayFirst: true });
    ['follow-up questions', 'shift responses', 'missed bids', 'who asks, who shares', 'match their energy', 'getting longer or shorter', '50 is an ordinary, fine chat',
      'meaningfulness 1-5', 'sharedExperiences', 'followup', 'paraphrase', 'remembered', 'Wednesday 2026-10-07', 'day first', 'chatDate', "in the user's own style"]
      .forEach(phrase => expect(system).toContain(phrase));
    expect(analysisSystem({ today: TODAY, dayFirst: false })).not.toContain('day first');
  });

  it('says where the chat is when there are only screenshots, and sends six at most', () => {
    const images = Array.from({ length: 8 }, (_, i) => ({ mediaType: 'image/jpeg', data: `I${i}` }));
    const req = analysisRequest({ person: priya, yourName: 'Sam', text: '', images });
    expect(req.content.filter(b => b.type === 'image')).toHaveLength(6);
    expect(req.content.at(-1)).toEqual({ type: 'text', text: 'The chat is in the screenshots above.' });
  });

  it('asks for an answer structured outputs can keep Claude to', () => {
    // Every object closed and every field required; no number limits.
    const walk = (s) => {
      if (s.type === 'object') {
        expect(s.additionalProperties).toBe(false);
        expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
        Object.values(s.properties).forEach(walk);
      }
      if (s.items) walk(s.items);
      if (s.anyOf) s.anyOf.forEach(walk);
      expect(s).not.toHaveProperty('minimum');
      expect(s).not.toHaveProperty('maximum');
    };
    walk(ANALYSIS_SCHEMA);
    walk(analysisSchema(['them 1', 'them 2', 'them 3']));
    // The reading comes before the scores.
    const order = Object.keys(ANALYSIS_SCHEMA.properties);
    expect(order.indexOf('wentWell')).toBeLessThan(order.indexOf('grading'));
    expect(order.at(-1)).toBe('log');
  });
});

describe('the answer', () => {
  const answer = {
    transcript: [{ who: 'them', text: 'Got the job!' }, { who: 'you', text: 'No way, [them]!' }],
    conversationState: 'engaged',
    wentWell: ['You celebrated [them]'],
    opportunity: 'Ask how [them] feels.',
    tryNextTime: 'Share yours.',
    encourager: { type: 'good', line: 'No way!', why: 'It invited more.' },
    emotionalCues: [{ emoji: '🎉', text: 'Excited' }],
    grading: { overall: 82, depth: 70, activeListening: 90, reciprocity: 60, naturalness: 75 },
    recommendation: null,
    extractedInfo: [{ category: 'experiences', text: '[them] got a new job', temporary: false }, { category: 'interests', text: 'reading', temporary: false }],
    next: { continueTopic: { text: 'Ask about it', natural: 'When do you start?', playful: 'Boss mode!', deeper: 'How do you feel?' }, shareYourself: null, changeTopic: null, dontMessage: null },
    log: { meaningfulness: 4, ratings: { depth: 3, trust: 4, reciprocity: 3, interaction: 5, sharedExperiences: 1, listening: 4 }, activeListening: ['followup', 'followup', 'remembered'], summary: '  Her new job  ', chatDate: '2026-10-06' },
  };

  it('is shaped like a sample, with names restored, a log ready to save, and details already known left out', () => {
    const r = analysisResult(answer, amelie, { today: TODAY });
    expect(r).toMatchObject({ own: true, personIds: ['a'], conversationState: 'engaged', recommendation: null, encourager: { type: 'good', line: 'No way!' } });
    expect(r.transcript).toEqual([{ who: 'them', text: 'Got the job!' }, { who: 'you', text: 'No way, Amelie!' }]);
    expect(r.wentWell).toEqual(['You celebrated Amelie']);
    expect(r.extractedInfo).toEqual([{ category: 'experiences', text: 'Amelie got a new job', temporary: false, personId: 'a' }]); // "reading" is on her profile
    expect(r.next.continueTopic.natural).toBe('When do you start?');
    expect(r.grading.goalImpact).toBeNull();
    expect(r.log).toEqual({ personIds: ['a'], meaningfulness: 4, ratings: { depth: 3, trust: 4, reciprocity: 3, interaction: 5, sharedExperiences: 1, listening: 4 }, activeListening: ['followup', 'remembered'], summary: 'Her new job', date: '2026-10-06' });
  });

  it('in a group, says whose each message and detail is', () => {
    const r = analysisResult({
      ...answer,
      transcript: [{ who: 'them 2', text: 'hi' }, { who: 'them 1', text: 'hey [them 2]' }, { who: 'you', text: 'yo' }],
      extractedInfo: [{ about: 'them 2', category: 'plans', text: '[them 2] is moving', temporary: false }],
    }, [amelie, chloe], { today: TODAY });
    expect(r.transcript).toEqual([{ who: 'them', name: 'Chloe', text: 'hi' }, { who: 'them', name: 'Amelie', text: 'hey Chloe' }, { who: 'you', text: 'yo' }]);
    expect(r.extractedInfo).toEqual([{ category: 'plans', text: 'Chloe is moving', temporary: false, personId: 'c', name: 'Chloe' }]);
    expect(r.log.personIds).toEqual(['a', 'c']);
  });

  it("only takes the chat's day when it's a real day, not in the future, and within the year", () => {
    const day = (chatDate) => analysisResult({ log: { chatDate } }, amelie, { today: TODAY }).log.date;
    expect(day('2026-10-07')).toBe('2026-10-07');
    expect(day('2026-10-08')).toBeNull();
    expect(day('2024-01-01')).toBeNull();
    expect(day('7/10/26')).toBeNull();
    expect(day(null)).toBeNull();
  });

  it('is made safe whatever comes back', () => {
    const r = analysisResult({
      transcript: [{ who: 'me', text: 'x' }, null, { who: 'you', text: 'ok' }],
      conversationState: 'excited',
      recommendation: '  ',
      grading: { overall: 140, depth: -5, activeListening: 'lots', reciprocity: 50.6, naturalness: null },
      encourager: { type: 'odd', line: 'mm' },
      emotionalCues: [1, 2, { emoji: '🙂', text: 'a' }, { emoji: '🙂', text: 'b' }, { emoji: '🙂', text: 'c' }, { emoji: '🙂', text: 'd' }],
      extractedInfo: [{ category: 'secrets', text: 'nope' }, { category: CATEGORIES[0].key, text: 'yes' }, { category: 'plans', text: '  ' }],
      next: { continueTopic: { text: 1 }, dontMessage: { text: 'Leave it' } },
      log: { meaningfulness: 9, ratings: { depth: 0, trust: 7, listening: 'x', made: 3 }, activeListening: ['hugged', 'listened'], summary: 4 },
    }, priya, { today: TODAY });
    expect(r.transcript).toEqual([{ who: 'you', text: 'ok' }]);
    expect(r.conversationState).toBe('unclear');
    expect(r.recommendation).toBeNull();
    expect(r.grading).toEqual({ overall: 100, depth: 0, activeListening: 0, reciprocity: 51, naturalness: 0, goalImpact: null });
    expect(r.encourager).toEqual({ type: 'improve', line: 'mm', why: '' });
    expect(r.emotionalCues.map(c => c.text)).toEqual(['a', 'b', 'c']);
    expect(r.extractedInfo.map(i => i.text)).toEqual(['yes']);
    expect(r.next).toEqual({ continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: { text: 'Leave it', natural: '', playful: '', deeper: '' } });
    expect(r.log).toEqual({ personIds: ['p1'], meaningfulness: 5, ratings: { trust: 5 }, activeListening: ['listened'], summary: '', date: null });
    expect(analysisResult(null, priya)).toMatchObject({ transcript: [], wentWell: [], opportunity: '', encourager: null, log: { meaningfulness: 3, ratings: {}, date: null } });
  });

  it('offers the models the main process allows, the cheapest first and by default', () => {
    expect(ANALYSIS_MODELS.map(m => m.id)).toEqual(MODELS);
    expect(DEFAULT_ANALYSIS_MODEL).toBe('claude-haiku-4-5');
    const cost = (m) => m.price.input + m.price.output;
    expect(ANALYSIS_MODELS.every((m, i) => i === 0 || cost(m) > cost(ANALYSIS_MODELS[i - 1]))).toBe(true);
    expect(analysisRequest({ person: priya, yourName: '', text: 'hi', model: 'claude-opus-5-5' }).model).toBe('claude-opus-5-5');
    expect(analysisRequest({ person: priya, yourName: '', text: 'hi', model: 'gpt-4' }).model).toBe('claude-haiku-4-5');
    expect(analysisRequest({ person: priya, yourName: '', text: 'hi' }).model).toBe('claude-haiku-4-5');
  });

  it("prices each model's tokens, and roughly what a chat costs before sending it", () => {
    expect(analysisCost({ input: 4000, output: 6000 }, 'claude-opus-5-5')).toBe('about US$0.14');
    expect(analysisCost({ input: 4000, output: 6000 }, 'claude-fable-5-1')).toBe('about US$0.34');
    expect(typicalCost('claude-haiku-4-5')).toBe('about US$0.02');
    expect(typicalCost('claude-sonnet-5-5')).toBe('about US$0.07');
  });

  it('says roughly what it cost, from the tokens used', () => {
    expect(analysisCost({ input: 4000, output: 2000 })).toBe('about US$0.01');
    expect(analysisCost({ input: 9000, output: 4000 })).toBe('about US$0.03');
    expect(analysisCost({ input: 1000, output: 500 })).toBe('under US$0.01');
    expect(analysisCost()).toBe('under US$0.01');
  });
});
