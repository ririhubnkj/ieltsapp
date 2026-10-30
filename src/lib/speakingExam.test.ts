import { describe, expect, it } from 'vitest';
import { parseTaskPrompts } from './presetLibrary';
import {
  basePresetId,
  examQuestions,
  examSteps,
  firstStepIndex,
  formatClock,
  groupByPart,
  listenFallbackMs,
  modelTopicFor,
  nextStepIndex,
  pickMimeType,
  pickRandom,
  presetNumber,
  remainingSeconds,
  SELF_CHECK,
  sessionTitle,
  speakingPart,
  stripMarkers,
} from './speakingExam';

const RAW = `**1**
Title: Hometown
Type: Speaking Part 1
- Where is your hometown?
- What do you like most about your hometown?

**5**
Title: A person who has influenced you
Type: Speaking Part 2 (1 minute to prepare, 1–2 minutes to speak)
Describe a person who has influenced you.
You should say:
- who this person is
- and explain how this person has influenced you.

**9**
Title: Role models
Type: Speaking Part 3
- What kind of people do young people look up to these days?
- Do you think famous people have a responsibility to be good role models?
- Are parents or teachers more important as role models for children?

**2**
Title: Work or Studies
Type: Speaking Part 1
- Do you work or are you a student?
`;

const prompts = parseTaskPrompts(RAW, 'speaking-');
const p1 = prompts.get('speaking-1')!;
const p2 = prompts.get('speaking-5')!;
const p3 = prompts.get('speaking-9')!;

describe('speakingPart / examQuestions', () => {
  it('reads the part from the Type line', () => {
    expect(speakingPart(p1)).toBe(1);
    expect(speakingPart(p2)).toBe(2);
    expect(speakingPart(p3)).toBe(3);
    expect(speakingPart({ title: '', headers: [], paragraphs: [], requirements: [], posts: [] })).toBeNull();
  });

  it('uses each question for Part 1/3 and the cue card task for Part 2', () => {
    expect(examQuestions(p1, 1)).toEqual(['Where is your hometown?', 'What do you like most about your hometown?']);
    expect(examQuestions(p3, 3)).toHaveLength(3);
    expect(examQuestions(p2, 2)).toEqual(['Describe a person who has influenced you.']);
  });
});

describe('examSteps', () => {
  it('Part 1 alternates listening and 30-second answers', () => {
    expect(examSteps(1, 2)).toEqual([
      { kind: 'listen', index: 0, seconds: 0 },
      { kind: 'speak', index: 0, seconds: 30 },
      { kind: 'listen', index: 1, seconds: 0 },
      { kind: 'speak', index: 1, seconds: 30 },
    ]);
  });

  it('Part 3 gives 60 seconds per question', () => {
    expect(examSteps(3, 3).filter((s) => s.kind === 'speak').map((s) => s.seconds)).toEqual([60, 60, 60]);
  });

  it('Part 2 is one minute of preparation then two minutes of speaking', () => {
    expect(examSteps(2, 1)).toEqual([
      { kind: 'prep', index: 0, seconds: 60 },
      { kind: 'speak', index: 0, seconds: 120 },
    ]);
  });

  it('skips listening steps when the voice is off, and ends after the last step', () => {
    const steps = examSteps(1, 2);
    expect(firstStepIndex(steps, { voice: true })).toBe(0);
    expect(firstStepIndex(steps, { voice: false })).toBe(1);
    expect(nextStepIndex(steps, 1, { voice: true })).toBe(2);
    expect(nextStepIndex(steps, 1, { voice: false })).toBe(3);
    expect(nextStepIndex(steps, 3, { voice: true })).toBeNull();
    expect(nextStepIndex(examSteps(2, 1), 0, { voice: false })).toBe(1);
  });
});

describe('time', () => {
  it('formats m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(-3)).toBe('0:00');
  });

  it('counts down in whole seconds without going below zero', () => {
    expect(remainingSeconds(30, 0)).toBe(30);
    expect(remainingSeconds(30, 200)).toBe(30);
    expect(remainingSeconds(30, 1000)).toBe(29);
    expect(remainingSeconds(30, 29_500)).toBe(1);
    expect(remainingSeconds(30, 31_000)).toBe(0);
  });

  it('estimates how long reading a question aloud takes', () => {
    expect(listenFallbackMs('Where is your hometown?')).toBe(4 * 500 + 4000);
  });
});

describe('pickMimeType', () => {
  it('prefers webm, falls back to mp4 for iOS Safari, else undefined', () => {
    expect(pickMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBeUndefined();
    expect(
      pickMimeType(() => {
        throw new Error('not supported');
      }),
    ).toBeUndefined();
  });
});

describe('presets', () => {
  it('maps level ids to the shared question id', () => {
    expect(basePresetId('speaking-l2-5')).toBe('speaking-5');
    expect(basePresetId('speaking-12')).toBe('speaking-12');
    expect(presetNumber('speaking-l2-15')).toBe(15);
  });

  it('finds the model answer for the same question at the current level', () => {
    const topics = [
      { presetId: 'speaking-l2-1', title: '1. Part 1｜Hometown', text: 'a' },
      { presetId: 'speaking-l2-5', title: '5. Part 2｜Person', text: 'b' },
    ];
    expect(modelTopicFor('speaking-5', topics)?.presetId).toBe('speaking-l2-5');
    expect(modelTopicFor('speaking-l4-1', topics)?.presetId).toBe('speaking-l2-1');
    expect(modelTopicFor('speaking-9', topics)).toBeUndefined();
  });

  it('strips the marking braces', () => {
    expect(stripMarkers("{{I'm originally from}} Kanazawa, {{+on the coast}}.")).toBe("I'm originally from Kanazawa, on the coast.");
  });

  it('groups the question sets by part in number order', () => {
    const groups = groupByPart([...prompts]);
    expect(groups[1].map((c) => c.id)).toEqual(['speaking-1', 'speaking-2']);
    expect(groups[2]).toEqual([{ id: 'speaking-5', title: 'A person who has influenced you', part: 2, questionCount: 1 }]);
    expect(groups[3][0]!.questionCount).toBe(3);
  });

  it('picks a random item', () => {
    expect(pickRandom([], () => 0.5)).toBeNull();
    expect(pickRandom(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickRandom(['a', 'b', 'c'], () => 0.99)).toBe('c');
    expect(pickRandom(['a', 'b', 'c'], () => 1)).toBe('c');
  });

  it('names the session and lists two checks for each of the four criteria', () => {
    expect(sessionTitle(p2, 2)).toBe('Speaking Part 2: A person who has influenced you');
    expect(SELF_CHECK).toHaveLength(4);
    for (const c of SELF_CHECK) expect(c.items).toHaveLength(2);
  });
});
