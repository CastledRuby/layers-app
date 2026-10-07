/** @vitest-environment jsdom */
// Real conversation analysis (docs/roadmap.md, "The plan from here", step 6):
// the key added in Me, then in Coach a pasted chat or screenshots sent to
// Claude only when you press Analyse, names hidden, and its answer shown like
// a sample's, to save from and log. The main process (the key, and Claude)
// is stood in for; jsdom can't decode pictures, so lib/photo.js is too.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { confirmDialog, dialog, nav, person, relaunch, renderApp, savedPerson, savedState, seedState, toasts } from './harness.jsx';

vi.mock('../../src/lib/photo.js', () => ({
  MAX_PHOTO_BYTES: 25 * 1024 * 1024,
  loadPhoto: async (file) => ({ naturalWidth: 400, naturalHeight: 800, src: `data:image/png;base64,${btoa(file.name)}` }),
  shrinkForAnalysis: (img) => ({ mediaType: 'image/jpeg', data: img.src.split(',')[1] }),
  renderPhoto: () => null,
  findFaces: async (files) => files.map(() => null),
}));

const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz_0123456789';
const YESTERDAY = toISODate(new Date(Date.now() - 24 * 3600 * 1000));
const ANSWER = {
  transcript: [{ who: 'them', text: 'I got the job!!' }, { who: 'you', text: 'No way [them], congrats!' }],
  conversationState: 'engaged',
  recommendation: null,
  grading: { overall: 80, depth: 70, activeListening: 84, reciprocity: 56, naturalness: 75 },
  wentWell: ['You celebrated [them] straight away'],
  opportunity: 'Ask what [them] is looking forward to.',
  tryNextTime: 'Share a first-day story of your own.',
  encourager: null,
  emotionalCues: [{ emoji: '🎉', text: 'Excited and proud' }],
  extractedInfo: [{ category: 'experiences', text: '[them] got a new job at the library', temporary: false }],
  next: { continueTopic: { text: 'Ask about the new job', natural: 'When do you start?', playful: 'Librarian era!', deeper: 'What made you go for it?' }, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 4, ratings: { depth: 3, trust: 4, reciprocity: 3, interaction: 5, sharedExperiences: 1, listening: 4 }, activeListening: ['followup'], summary: 'Her new job at the library', chatDate: YESTERDAY },
};
// A phone or tablet: screenshots are offered there.
function touchScreen() {
  window.matchMedia = (query) => ({ matches: query.includes('pointer: coarse'), media: query, addEventListener() {}, removeEventListener() {} });
}

function fakeBridge({ hasKey = false, answer = { result: ANSWER, usage: { input: 9000, output: 4000 } } } = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    hasKey,
    getAnalysisKeyStatus: async () => ({ hasKey: b.hasKey }),
    setAnalysisKey: vi.fn(async (key) => { if (key !== KEY) return { error: "That API key isn't working." }; b.hasKey = true; return { ok: true }; }),
    clearAnalysisKey: vi.fn(async () => { b.hasKey = false; return { ok: true }; }),
    runAnalysis: vi.fn(async () => answer),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; delete window.matchMedia; window.localStorage.removeItem('layers-analysis-spend'); });

async function openAnalyse(user, name) {
  await user.click(nav('Coach'));
  await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
  await user.click(screen.getByRole('button', { name: new RegExp(name) }));
}

describe('chat analysis with Claude', () => {
  it('needs a key, added in Me and checked there', async () => {
    const bridge = fakeBridge();
    seedState({ people: [person('Priya Shah')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    expect(screen.queryByLabelText('The chat')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add a key in Me' }));
    const card = () => screen.getByLabelText('Chat analysis');
    await user.type(within(card()).getByLabelText('Anthropic API key'), 'sk-ant-wrong{Enter}');
    expect((await within(card()).findByRole('alert')).textContent).toMatch(/isn't working/);
    await user.clear(within(card()).getByLabelText('Anthropic API key'));
    await user.type(within(card()).getByLabelText('Anthropic API key'), `${KEY}{Enter}`);
    await waitFor(() => expect(toasts()).toContain('Chat analysis is ready in Coach'));
    expect(bridge.setAnalysisKey).toHaveBeenLastCalledWith(KEY);
    expect(within(card()).queryByLabelText('Anthropic API key')).toBeNull();
    expect(JSON.stringify(savedState())).not.toContain('sk-ant'); // the key stays with the main process

    await openAnalyse(user, 'Priya');
    expect(screen.getByLabelText('The chat')).toBeTruthy();

    await user.click(nav('Me'));
    await user.click(within(card()).getByRole('button', { name: 'Remove the key' }));
    await user.click(within(confirmDialog('Remove your API key?')).getByRole('button', { name: 'Remove' }));
    expect(bridge.clearAnalysisKey).toHaveBeenCalled();
    expect(within(card()).getByLabelText('Anthropic API key')).toBeTruthy();
  });

  it('sends the pasted chat with names hidden, only when asked, and shows the answer with their name back', async () => {
    const bridge = fakeBridge({ hasKey: true });
    seedState({ profile: { name: 'Sam', focus: 'mix' }, people: [person('Priya Shah', { layer: 2 })] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    const own = () => screen.getByLabelText('Your own chat');
    expect(within(own()).getByText(/sends this chat, and only this chat, to Anthropic/)).toBeTruthy();
    expect(within(own()).getByRole('button', { name: 'Analyse with Claude' }).disabled).toBe(true);
    await user.type(within(own()).getByLabelText('The chat'), 'Priya: I got the job!!{Enter}Sam: No way Priya, congrats!');
    expect(bridge.runAnalysis).not.toHaveBeenCalled();
    await user.click(within(own()).getByRole('button', { name: 'Analyse with Claude' }));

    await screen.findByText('Reconstructed conversation');
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content).toEqual([{ type: 'text', text: 'The chat:\n\n[them]: I got the job!!\n[you]: No way [them], congrats!' }]);
    expect(JSON.stringify(sent)).not.toMatch(/Priya|Sam/);
    expect(sent.system).toMatch(/Layer 2/);

    expect(screen.getByText('No way Priya, congrats!')).toBeTruthy();
    expect(screen.getByText(/this one cost about US\$0\.03/)).toBeTruthy();
    expect(screen.getByText(/You celebrated Priya straight away/)).toBeTruthy();
    expect(screen.queryByText('Encourager use')).toBeNull(); // none in this chat
    expect(screen.getByText('Librarian era!')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedPerson('Priya Shah').experiences[0].text).toBe('Priya got a new job at the library');

    // The log, filled in by Claude on Layers' own scales, on the chat's day.
    const log = () => screen.getByLabelText('Log it');
    expect(within(log()).getByText(/Messaged Priya Shah · Personal \(4 of 5\)/)).toBeTruthy();
    expect(within(log()).getByText("from the chat's times")).toBeTruthy();
    expect(within(log()).getByText('Depth 3 · Trust 4 · Reciprocity 3 · Interaction 5 · Shared experiences 1 · Listening / connection 4')).toBeTruthy();
    expect(within(log()).getByText(/Asked follow-up questions/)).toBeTruthy();
    await user.click(within(log()).getByRole('button', { name: 'Log this chat' }));
    expect(savedState().journal).toEqual([expect.objectContaining({
      type: 'messaged', at: YESTERDAY, meaningfulness: 4, summary: 'Her new job at the library', activeListening: ['followup'],
      ratings: { depth: 3, trust: 4, reciprocity: 3, interaction: 5, sharedExperiences: 1, listening: 4 },
      analysis: expect.objectContaining({ grading: expect.objectContaining({ overall: 80 }), conversationState: 'engaged', model: 'claude-haiku-4-5' }),
    })]);
    expect(toasts()).toContain('Logged time with Priya Shah');
    expect(within(log()).queryByRole('button', { name: 'Log this chat' })).toBeNull();

    // Another chat starts empty, as its own session.
    await user.click(screen.getByRole('button', { name: '← Analyse another chat' }));
    expect(within(own()).getByLabelText('The chat').value).toBe('');

    // The log keeps Claude's review and the chat itself (with real names), to read again from the Journal.
    expect(savedState().journal[0].analysis).toMatchObject({
      chat: 'Priya: I got the job!!\nSam: No way Priya, congrats!',
      review: { wentWell: ['You celebrated Priya straight away'], opportunity: 'Ask what Priya is looking forward to.', next: { continueTopic: { playful: 'Librarian era!' } } },
    });
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /^Chat review: Priya Shah/ }));
    const sheet = dialog('Chat review: Priya Shah');
    expect(within(sheet).getByText(/You celebrated Priya straight away/)).toBeTruthy();
    expect(within(sheet).getByText('Librarian era!')).toBeTruthy();
    expect(within(sheet).queryByLabelText('The chat')).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Show the chat' }));
    expect(within(sheet).getByLabelText('The chat').textContent).toBe('Priya: I got the job!!\nSam: No way Priya, congrats!');
    await user.keyboard('{Escape}');
    // The Journal's search looks in kept chats too.
    await user.type(screen.getByLabelText('Search the journal'), 'congrats');
    expect(screen.getByRole('button', { name: /^Chat review: Priya Shah/ })).toBeTruthy();
    await user.clear(screen.getByLabelText('Search the journal'));
    await user.type(screen.getByLabelText('Search the journal'), 'pineapple');
    expect(screen.queryByRole('button', { name: /^Chat review: Priya Shah/ })).toBeNull();
  });

  it("on a laptop it's for pasting: no screenshots", async () => {
    fakeBridge({ hasKey: true });
    seedState({ people: [person('Priya Shah')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    const own = screen.getByLabelText('Your own chat');
    expect(within(own).queryByLabelText('Add screenshots')).toBeNull();
    expect(within(own).queryByRole('button', { name: /Screenshots/ })).toBeNull();
    expect(within(own).queryByText(/screenshots go as they are/)).toBeNull();
  });

  it('on a phone, sends screenshots too, six at most, and each can be taken out first', async () => {
    touchScreen();
    const bridge = fakeBridge({ hasKey: true });
    seedState({ people: [person('Priya Shah')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    const own = () => screen.getByLabelText('Your own chat');
    const shots = Array.from({ length: 7 }, (_, i) => new File(['x'], `shot${i + 1}.png`, { type: 'image/png' }));
    await user.upload(within(own()).getByLabelText('Add screenshots'), shots);
    await within(own()).findByAltText('shot6.png');
    expect(within(own()).queryByAltText('shot7.png')).toBeNull();
    expect(within(own()).queryByRole('button', { name: /Screenshots/ })).toBeNull(); // full
    await user.click(within(own()).getByRole('button', { name: 'Remove shot2.png' }));
    await user.click(within(own()).getByRole('button', { name: 'Analyse with Claude' }));
    await screen.findByText('Reconstructed conversation');
    const sent = bridge.runAnalysis.mock.calls[0][0].content;
    expect(sent.filter(b => b.type === 'image').map(b => atob(b.source.data))).toEqual(['shot1.png', 'shot3.png', 'shot4.png', 'shot5.png', 'shot6.png']);
    expect(sent.at(-1)).toEqual({ type: 'text', text: 'The chat is in the screenshots above.' });
  });

  it('says what went wrong and keeps the chat to try again', async () => {
    fakeBridge({ hasKey: true, answer: { error: 'Your Anthropic credit has run out. Add some at console.anthropic.com.' } });
    seedState({ people: [person('Priya Shah')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    const own = () => screen.getByLabelText('Your own chat');
    await user.type(within(own()).getByLabelText('The chat'), 'hello');
    await user.click(within(own()).getByRole('button', { name: 'Analyse with Claude' }));
    expect((await within(own()).findByRole('alert')).textContent).toMatch(/credit has run out/);
    expect(within(own()).getByLabelText('The chat').value).toBe('hello');
    expect(screen.queryByText('Reconstructed conversation')).toBeNull();
  });

  it("drops an answer that arrives after you've moved on to someone else", async () => {
    let answer;
    const bridge = fakeBridge({ hasKey: true });
    bridge.runAnalysis = vi.fn(() => new Promise((resolve) => { answer = resolve; }));
    seedState({ people: [person('Priya Shah'), person('Morgan')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    await user.type(within(screen.getByLabelText('Your own chat')).getByLabelText('The chat'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Analyse with Claude' }));
    expect(screen.getByText('Claude Haiku 4.5 is reading the chat…')).toBeTruthy();
    await user.keyboard('1'); // Prepare
    await user.keyboard('{ArrowRight}'); // Morgan
    await user.keyboard('a'); // analyse a chat with Morgan
    expect(screen.getByText(/Analysing a conversation with/).textContent).toMatch(/Morgan/);
    answer({ result: ANSWER, usage: { input: 1, output: 1 } });
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(screen.queryByText('Reconstructed conversation')).toBeNull();
    expect(screen.getByLabelText('Your own chat')).toBeTruthy();
  });

  it('uses the cheapest model unless you pick another, and tries the same chat with another in a click', async () => {
    const bridge = fakeBridge({ hasKey: true });
    bridge.runAnalysis = vi.fn(async (request) => ({ result: { ...ANSWER, opportunity: `From ${request.model}` }, usage: { input: 4000, output: 6000 }, model: request.model }));
    seedState({ people: [person('Priya Shah')] });
    const app = renderApp();
    const { user } = app;
    await openAnalyse(user, 'Priya');
    const models = () => within(screen.getByRole('group', { name: 'Model' }));
    expect(models().getByRole('button', { name: /Haiku 4\.5/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/to Anthropic for Claude Haiku 4\.5 to read \(about US\$0\.02\)/)).toBeTruthy();
    await user.click(models().getByRole('button', { name: /Opus 5\.5/ }));
    expect(screen.getByText(/for Claude Opus 5\.5 to read \(about US\$0\.14; it thinks first/)).toBeTruthy();
    await user.type(screen.getByLabelText('The chat'), 'Priya: hi');
    await user.click(screen.getByRole('button', { name: 'Analyse with Claude' }));
    await screen.findByText('From claude-opus-5-5');
    expect(bridge.runAnalysis.mock.calls[0][0].model).toBe('claude-opus-5-5');
    expect(screen.getByText(/Read by Claude Opus 5\.5: this one cost about US\$0\.14/)).toBeTruthy();

    // The same chat with Sonnet: sent once, with the same content.
    const again = () => within(screen.getByRole('group', { name: 'The same chat with' }));
    await user.click(again().getByRole('button', { name: /Sonnet 5\.5/ }));
    await screen.findByText('From claude-sonnet-5-5');
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(2);
    expect(bridge.runAnalysis.mock.calls[1][0]).toMatchObject({ model: 'claude-sonnet-5-5', content: bridge.runAnalysis.mock.calls[0][0].content });
    expect(screen.getByText(/Read by Claude Sonnet 5\.5: this one cost about US\$0\.07/)).toBeTruthy();
    // Back to Opus: its answer again, without asking again.
    await user.click(again().getByRole('button', { name: /Opus 5\.5/ }));
    expect(screen.getByText('From claude-opus-5-5')).toBeTruthy();
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(2);
    // One chat is logged once, whichever answer it's logged from.
    await user.click(screen.getByRole('button', { name: 'Log this chat' }));
    await user.click(again().getByRole('button', { name: /Sonnet 5\.5/ }));
    expect(screen.queryByRole('button', { name: 'Log this chat' })).toBeNull();
    expect(savedState().journal).toHaveLength(1);

    // Me says what they cost: each answer once, by model.
    await user.click(nav('Me'));
    const spent = screen.getByLabelText('What Claude has cost');
    expect(spent.textContent).toMatch(/This month: about US\$0\.20 for 2 chats \(Opus 5\.5 1, Sonnet 5\.5 1\)/);
    await user.click(nav('Coach'));

    // Started again, it's the cheapest again.
    const next = relaunch(app);
    await openAnalyse(next.user, 'Priya');
    expect(models().getByRole('button', { name: /Haiku 4\.5/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('says what went wrong trying another model, and keeps the first answer', async () => {
    const bridge = fakeBridge({ hasKey: true });
    bridge.runAnalysis = vi.fn(async (request) => (request.model === 'claude-fable-5-1' ? { error: 'Your Anthropic credit has run out. Add some at console.anthropic.com.' } : { result: ANSWER, usage: { input: 1, output: 1 }, model: request.model }));
    seedState({ people: [person('Priya Shah')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    await user.type(screen.getByLabelText('The chat'), 'Priya: hi');
    await user.click(screen.getByRole('button', { name: 'Analyse with Claude' }));
    await screen.findByText('Reconstructed conversation');
    await user.click(within(screen.getByRole('group', { name: 'The same chat with' })).getByRole('button', { name: /Fable 5\.1/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/credit has run out/);
    expect(screen.getByText(/Read by Claude Haiku 4\.5/)).toBeTruthy();
  });

  it("knows who it's with from the names on the messages, so a chat with Amelie goes to Amelie", async () => {
    const bridge = fakeBridge({ hasKey: true });
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 }), person('Chloe', { layer: 3 })] });
    const { user } = renderApp();
    await openAnalyse(user, 'Chloe'); // the wrong person picked
    const own = () => screen.getByLabelText('Your own chat');
    const withRow = () => within(own()).getByRole('group', { name: "Who it's with" });
    expect(withRow().textContent).toMatch(/Chloe/);
    await user.click(within(own()).getByLabelText('The chat'));
    await user.paste('[6/10/26, 9:41 pm] Amelie: I got the job!!\n[6/10/26, 9:42 pm] Liam: No way Amelie, congrats!');
    expect(withRow().textContent).toMatch(/Amelie/);
    expect(withRow().textContent).not.toMatch(/Chloe/);
    expect(within(own()).getByText('from the names in the chat')).toBeTruthy();
    expect(screen.getByText(/Analysing a conversation with/).textContent).toMatch(/Amelie/);
    await user.click(within(own()).getByRole('button', { name: 'Analyse with Claude' }));
    await screen.findByText('Reconstructed conversation');
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content.at(-1).text).toBe('The chat:\n\n[6/10/26, 9:41 pm] [them]: I got the job!!\n[6/10/26, 9:42 pm] [you]: No way [them], congrats!');
    expect(sent.system).toMatch(/Layer 4/);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Log this chat' }));
    expect(savedPerson('Amelie').experiences[0].text).toBe('Amelie got a new job at the library');
    expect(savedState().journal.map(j => j.personId)).toEqual([savedPerson('Amelie').id]);
    expect(savedPerson('Chloe').experiences).toEqual([]);
  });

  it('a group chat: everyone in it, tagged apart, each detail to its person, one log with all of them', async () => {
    const bridge = fakeBridge({ hasKey: true });
    bridge.runAnalysis = vi.fn(async () => ({ result: {
      ...ANSWER,
      transcript: [{ who: 'them 1', text: 'hi both' }, { who: 'them 2', text: 'hey [them 1]' }, { who: 'you', text: 'yo' }],
      extractedInfo: [{ about: 'them 2', category: 'plans', text: '[them 2] is moving to Wellington', temporary: false }],
    }, usage: { input: 1, output: 1 }, model: 'claude-haiku-4-5' }));
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 }), person('Chloe', { layer: 3 }), person('Zoe')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Amelie');
    const own = () => screen.getByLabelText('Your own chat');
    // Chosen by hand: "Someone else" adds Chloe, and pasting then doesn't change it.
    await user.click(within(own()).getByRole('button', { name: /Someone else/ }));
    await user.click(within(own()).getByRole('button', { name: /Chloe/ }));
    await user.click(within(own()).getByLabelText('The chat'));
    await user.paste('Amelie: hi both\nChloe: hey Amelie\nLiam: yo');
    expect(within(own()).getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Amelie.*Chloe/);
    expect(within(own()).getByText(/Amelie, Chloe's name and yours are swapped for tags/)).toBeTruthy();
    await user.click(within(own()).getByRole('button', { name: 'Analyse with Claude' }));
    await screen.findByText('Reconstructed conversation');
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content.at(-1).text).toBe('The chat:\n\n[them 1]: hi both\n[them 2]: hey [them 1]\n[you]: yo');
    expect(sent.schema.properties.extractedInfo.items.properties.about.enum).toEqual(['them 1', 'them 2']);
    expect(screen.getByText('hey Amelie')).toBeTruthy();
    expect(screen.getByText(/About Chloe · Category: Plans/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedPerson('Chloe').plans[0].text).toBe('Chloe is moving to Wellington');
    expect(within(screen.getByLabelText('Log it')).getByText(/Messaged Amelie, Chloe/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Log this chat' }));
    expect(savedState().journal.map(j => j.personId).sort()).toEqual([savedPerson('Amelie').id, savedPerson('Chloe').id].sort());
  });

  it("isn't offered in the browser, where there's nowhere safe for a key", async () => {
    seedState({ people: [person('Priya Shah')] });
    const { user } = renderApp();
    await openAnalyse(user, 'Priya');
    expect(screen.queryByLabelText('Your own chat')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a key in Me' })).toBeNull();
    expect(screen.getByText('Try a sample conversation')).toBeTruthy();
    await user.click(nav('Me'));
    expect(screen.queryByLabelText('Chat analysis')).toBeNull();
  });
});
