import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../app/examples';
import { normalizeArabic } from '../design/arabic';
import { ICONS, iconById, suggestIcon } from '../design/icons';
import { validateTimeline } from '../domain/timeline';
import { generateProject } from '../engine/planner';
import { buildStoryboard } from '../engine/parser/storyboard';
import { extractTopic, splitSentences } from '../engine/parser/text';

const opts = { aspect: 'landscape' as const, style: {} };
const fold = (s: string) => normalizeArabic(s).replace(/[^\p{L}\p{N}%٪]+/gu, '');

describe('storyboard parser', () => {
  it('extracts the topic from a request sentence', () => {
    expect(extractTopic('أريد فيديو إنفوجرافيك عن فوائد القراءة')).toBe('فوائد القراءة');
    expect(extractTopic('اعمل لي فيديو تعليمي يشرح دورة الماء في الطبيعة.')).toBe('دورة الماء في الطبيعة');
    expect(extractTopic('صمم انفوجرافيك عن الذكاء الاصطناعي')).toBe('الذكاء الاصطناعي');
  });

  it('splits Arabic sentences on Arabic punctuation', () => {
    expect(splitSentences('هذه جملة. وهذه أخرى؟ وثالثة!')).toHaveLength(3);
  });

  it.each(EXAMPLES.map((e) => [e.label, e.text]))('example %s produces a valid, varied 120 s project', (_, text) => {
    const { project, usedPlaceholders } = generateProject(text, opts);
    expect(usedPlaceholders).toBe(false);
    expect(validateTimeline(project)).toEqual([]);
    expect(project.scenes.length).toBeGreaterThanOrEqual(5);
    expect(project.scenes.length).toBeLessThanOrEqual(20);
    expect(project.scenes[0].kind).toBe('hero');
    expect(project.scenes.at(-1)!.kind).toBe('outro');
    expect(new Set(project.scenes.map((s) => s.kind)).size).toBeGreaterThanOrEqual(4);
    for (const s of project.scenes) expect(iconById(s.icon), `${s.kind}:${s.icon}`).toBeDefined();
  });

  it('does not invent facts: content items come from the description', () => {
    for (const ex of EXAMPLES) {
      const board = buildStoryboard(ex.text);
      const source = fold(ex.text);
      for (const s of board.scenes.slice(1, -1)) {
        for (const item of s.items) {
          const piece = fold(item.replace(/…$/, ''));
          expect(source.includes(piece), `"${item}" not in source`).toBe(true);
        }
      }
    }
  });

  it('recognises stats, steps, bars, timeline, quote and question scenes', () => {
    const kinds = (t: string) => buildStoryboard(t).scenes.map((s) => s.kind);
    expect(kinds(EXAMPLES[0].text)).toEqual(expect.arrayContaining(['stat', 'steps', 'quote']));
    expect(kinds(EXAMPLES[2].text)).toEqual(expect.arrayContaining(['timeline', 'summary']));
    expect(kinds(EXAMPLES[3].text)).toEqual(expect.arrayContaining(['comparison', 'stat', 'steps']));
    const qa = buildStoryboard('الصحة\nلماذا ننام؟ لأن النوم يجدد الطاقة.');
    expect(qa.scenes[1]).toMatchObject({ kind: 'summary', title: 'لماذا ننام؟' });
    const cmp = buildStoryboard('الطاقة\nالطاقة الشمسية نظيفة ومتجددة بينما الفحم يلوث الهواء.');
    expect(cmp.scenes[1].kind).toBe('comparison');
    expect(cmp.scenes[1].items).toHaveLength(2);
  });

  it('keeps Arabic-Indic digits and mixed Latin terms in stat values', () => {
    const b = buildStoryboard('العنوان\nيستخدم ٨٥٪ من الطلاب تطبيقات AI يوميًا.');
    const stat = b.scenes.find((s) => s.kind === 'stat')!;
    expect(stat.items[0]).toBe('٨٥٪');
    expect(stat.items[1]).toContain('AI');
  });

  it('adds clearly marked guide scenes for a one-line idea', () => {
    const { project, usedPlaceholders } = generateProject('أريد فيديو عن فوائد القراءة', opts);
    expect(usedPlaceholders).toBe(true);
    expect(project.title).toBe('فوائد القراءة');
    expect(validateTimeline(project)).toEqual([]);
    expect(project.scenes.some((s) => s.items.some((i) => i.startsWith('[')))).toBe(true);
  });

  it('handles empty, huge and hostile input without throwing', () => {
    for (const t of ['', '   ', '<script>alert(1)</script>', 'أ'.repeat(10000), '1. \n2. \n- ', '٪٪٪ ::: ---']) {
      const { project } = generateProject(t, opts);
      expect(validateTimeline(project)).toEqual([]);
      for (const s of project.scenes) {
        expect(s.title.length).toBeLessThanOrEqual(160);
        s.items.forEach((i) => expect(i.length).toBeLessThanOrEqual(160));
      }
    }
  });

  it('is deterministic', () => {
    expect(generateProject(EXAMPLES[1].text, opts)).toEqual(generateProject(EXAMPLES[1].text, opts));
  });
});

describe('icons', () => {
  it('has unique ids', () => {
    expect(new Set(ICONS.map((i) => i.id)).size).toBe(ICONS.length);
  });

  it('suggests icons from Arabic keywords', () => {
    expect(suggestIcon('فوائد شرب الماء', 'x')).toBe('droplet');
    expect(suggestIcon('التغذية الصحية', 'x')).toBe('salad');
    expect(suggestIcon('الذكاء الاصطناعي في التعليم', 'x')).toBe('brain-circuit');
    expect(suggestIcon('كلام عام', 'sparkles')).toBe('sparkles');
  });
});
