// Real conversation analysis, the page's half (lib/analysis.js): names kept
// out of pasted text and put back into the answer, the request, and an
// answer made safe to show whatever comes back.
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './data/constants.js';
import { MODELS } from '../electron/analysis.cjs';
import { ANALYSIS_MODELS, ANALYSIS_SCHEMA, analysisCost, analysisRequest, analysisResult, DEFAULT_ANALYSIS_MODEL, hideNames, restoreNames, typicalCost } from './lib/analysis.js';

const priya = { id: 'p1', name: 'Priya Shah', layer: 2 };

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

  it('puts their first name back throughout the answer, and "you" for you', () => {
    expect(restoreNames({ a: ['[them] liked it', { b: '[You] asked [THEM]' }], n: 3 }, 'Priya Shah'))
      .toEqual({ a: ['Priya liked it', { b: 'you asked Priya' }], n: 3 });
  });
});

describe('the request', () => {
  it('sends the screenshots, then the pasted chat with names hidden', () => {
    const images = [{ mediaType: 'image/jpeg', data: 'AAA' }];
    const req = analysisRequest({ person: priya, yourName: 'Sam', text: '  Priya: hi Sam  ', images });
    expect(req.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' } },
      { type: 'text', text: 'The chat:\n\n[them]: hi [you]' },
    ]);
    expect(req.system).toMatch(/Layer 2/);
    expect(req.system).not.toMatch(/Priya|Sam/);
    expect(req.schema).toBe(ANALYSIS_SCHEMA);
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
  });
});

describe('the answer', () => {
  it('is shaped like a sample, with names restored', () => {
    const raw = {
      transcript: [{ who: 'them', text: 'Got the job!' }, { who: 'you', text: 'No way, [them]!' }],
      conversationState: 'engaged',
      recommendation: null,
      grading: { overall: 82, depth: 70, activeListening: 90, reciprocity: 60, naturalness: 75, goalImpact: 9 },
      wentWell: ['You celebrated [them]'],
      opportunity: 'Ask how [them] feels.',
      tryNextTime: 'Share yours.',
      encourager: { type: 'good', line: 'No way!', why: 'It invited more.' },
      emotionalCues: [{ emoji: '🎉', text: 'Excited' }],
      extractedInfo: [{ category: 'experiences', text: '[them] got a new job', temporary: false }],
      next: { continueTopic: { text: 'Ask about it', natural: 'When do you start?', playful: 'Boss mode!', deeper: 'How do you feel?' }, shareYourself: null, changeTopic: null, dontMessage: null },
    };
    const r = analysisResult(raw, priya);
    expect(r).toMatchObject({ own: true, conversationState: 'engaged', recommendation: null, encourager: { type: 'good', line: 'No way!' } });
    expect(r.transcript[1].text).toBe('No way, Priya!');
    expect(r.wentWell).toEqual(['You celebrated Priya']);
    expect(r.extractedInfo).toEqual([{ category: 'experiences', text: 'Priya got a new job', temporary: false }]);
    expect(r.next.continueTopic.natural).toBe('When do you start?');
  });

  it('is made safe whatever comes back', () => {
    const r = analysisResult({
      transcript: [{ who: 'me', text: 'x' }, null, { who: 'you', text: 'ok' }],
      conversationState: 'excited',
      recommendation: '  ',
      grading: { overall: 140, depth: -5, activeListening: 'lots', reciprocity: 50.6, naturalness: null, goalImpact: 40 },
      encourager: { type: 'odd', line: 'mm' },
      emotionalCues: [1, 2, { emoji: '🙂', text: 'a' }, { emoji: '🙂', text: 'b' }, { emoji: '🙂', text: 'c' }, { emoji: '🙂', text: 'd' }],
      extractedInfo: [{ category: 'secrets', text: 'nope' }, { category: CATEGORIES[0].key, text: 'yes' }],
      next: { continueTopic: { text: 1 }, dontMessage: { text: 'Leave it' } },
    }, priya);
    expect(r.transcript).toEqual([{ who: 'you', text: 'ok' }]);
    expect(r.conversationState).toBe('unclear');
    expect(r.recommendation).toBeNull();
    expect(r.grading).toEqual({ overall: 100, depth: 0, activeListening: 0, reciprocity: 51, naturalness: 0, goalImpact: 15 });
    expect(r.encourager).toEqual({ type: 'improve', line: 'mm', why: '' });
    expect(r.emotionalCues.map(c => c.text)).toEqual(['a', 'b', 'c']);
    expect(r.extractedInfo.map(i => i.text)).toEqual(['yes']);
    expect(r.next).toEqual({ continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: { text: 'Leave it', natural: '', playful: '', deeper: '' } });
    expect(analysisResult(null, priya)).toMatchObject({ transcript: [], wentWell: [], opportunity: '', encourager: null });
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
