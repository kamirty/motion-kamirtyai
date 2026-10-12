import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/project.v1.schema.json';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import { validateTimeline, withScenes } from '../domain/timeline';
import { EMPTY_LESSON, SAMPLE_LESSON, lessonGaps, lessonScenes } from '../engine/lesson';
import { quizParts } from '../engine/sceneModel';
import { renderFrame } from '../engine/renderer/renderFrame';
import { createFakeCtx } from './fakeCtx';

describe('teacher lesson workflow', () => {
  it('turns a full lesson into the expected scene sequence', () => {
    const kinds = lessonScenes(SAMPLE_LESSON).map((s) => s.kind);
    expect(kinds).toEqual(['hero', 'tip', 'definition', 'cycle', 'tip', 'quiz', 'outro']);
  });

  it('marks the right answer and keeps the teacher text verbatim (Arabic + numbers + Latin)', () => {
    const lesson = { ...SAMPLE_LESSON, fact: 'نحو 97% من مياه الأرض مالحة وفق UN Water' };
    const scenes = lessonScenes(lesson);
    const quiz = scenes.find((s) => s.kind === 'quiz')!;
    expect(quizParts(quiz).answer).toBe(1);
    expect(scenes.find((s) => s.title === 'هل تعلم؟')!.items[0]).toBe('نحو 97% من مياه الأرض مالحة وفق UN Water');
    expect(scenes[0].items[0]).toBe('العلوم · الصف الرابع');
  });

  it('skips empty steps and never invents content', () => {
    const scenes = lessonScenes({ ...EMPTY_LESSON, title: 'الكسور', points: ['البسط', 'المقام', ''] });
    expect(scenes.map((s) => s.kind)).toEqual(['hero', 'steps', 'outro']);
    expect(scenes[1].items).toEqual(['البسط', 'المقام']);
    // A cycle or pyramid needs three points; with two it falls back to steps.
    expect(lessonScenes({ ...EMPTY_LESSON, title: 'x', points: ['أ', 'ب'], pointsStyle: 'cycle' })[1].kind).toBe('steps');
  });

  it('reports what is missing', () => {
    expect(lessonGaps(EMPTY_LESSON)).toEqual(['عنوان الدرس', 'نقاط الدرس']);
    expect(lessonGaps({ ...SAMPLE_LESSON, correct: -1 })).toEqual(['الإجابة الصحيحة']);
  });

  it('produces a valid project that renders every frame-region and survives the sanitiser', () => {
    const p = withScenes({ ...sampleProject, title: SAMPLE_LESSON.title }, lessonScenes(SAMPLE_LESSON));
    expect(validateTimeline(p)).toEqual([]);
    const json = JSON.parse(JSON.stringify(p));
    expect(new Ajv2020({ allErrors: true }).compile(schema)(json)).toBe(true);
    expect(parseProject(json).scenes).toHaveLength(p.scenes.length);
    for (let f = 0; f < p.durationFrames; f += 15) expect(() => renderFrame(p, f, createFakeCtx().ctx)).not.toThrow();
  });
});
