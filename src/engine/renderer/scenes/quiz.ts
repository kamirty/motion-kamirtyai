import { localizeDigits } from '../../../design/digits';
import { alpha, readableOn } from '../../../design/presets';
import { easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { card, drawHeader, withAlpha, type SceneDrawArgs } from '../kit';
import { QUIZ_COUNTDOWN, itemReveal, quizCountdown } from '../../timing';
import { quizParts } from '../../sceneModel';
import { drawIcon } from '../icons';
import { discLabel, measure } from './common';
import { drawLines } from '../textLayout';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

/** سؤال واختيارات: options pop in, a 3-2-1 countdown, then the answer is revealed. */
export function drawQuiz(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const { options, answer } = quizParts(scene);
  const n = options.length;
  if (!n) return;
  const c0 = quizCountdown(scene);
  const revealAt = c0 + QUIZ_COUNTDOWN;
  const revealed = answer >= 0 && frame >= revealAt;
  const rt = answer >= 0 ? easeOutCubic(progress(frame, revealAt, 18)) : 0;
  const counterW = answer >= 0 && !L.portrait ? 200 : 0;
  const counterH = answer >= 0 && L.portrait ? 170 : 0;
  const cols = !L.portrait && n >= 3 && n <= 4 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gap = 18;
  const areaW = L.W - L.M * 2 - counterW;
  const avail = L.H - top - L.M - counterH;
  const cw = (areaW - gap * (cols - 1)) / cols;
  const ch = Math.min(L.portrait ? 130 : 120, (avail - gap * (rows - 1)) / rows);
  const y0 = top + Math.max(0, (avail - (ch * rows + gap * (rows - 1))) / 2);
  options.forEach((opt, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 20);
    if (t <= 0) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = L.W - L.M - cw - col * (cw + gap);
    const y = y0 + row * (ch + gap);
    const correct = revealed && i === answer;
    const dim = revealed && i !== answer ? 1 - 0.55 * rt : 1;
    const pulse = correct ? 1 + 0.03 * Math.sin((frame - revealAt) / 5) : 1;
    withAlpha(ctx, Math.min(1, t * 1.4) * dim, () => {
      ctx.save();
      const s = (0.9 + 0.1 * easeOutBack(t)) * pulse;
      ctx.translate(x + cw / 2, y + ch / 2);
      ctx.scale(s, s);
      ctx.translate(-(x + cw / 2), -(y + ch / 2));
      card(ctx, theme, x, y, cw, ch, 16, correct ? theme.accent : theme.surface);
      const fg = correct ? readableOn(theme.accent) : theme.foreground;
      const hasLetter = /^\s*[أابجدهـو1-6١-٦][).:-]/u.test(opt);
      const r = Math.min(30, ch * 0.28);
      if (correct) {
        ctx.fillStyle = readableOn(theme.accent);
        ctx.beginPath();
        ctx.arc(x + cw - 24 - r, y + ch / 2, r, 0, Math.PI * 2);
        ctx.fill();
        drawIcon(ctx, 'check', x + cw - 24 - r, y + ch / 2, r * 1.3, theme.accent, 3);
      } else if (!hasLetter) {
        discLabel(ctx, fs, LETTERS[i] ?? localizeDigits(String(i + 1), digits), x + cw - 24 - r, y + ch / 2, r, alpha(theme.accent, 0.9));
      }
      const pad = hasLetter && !correct ? 26 : r * 2 + 44;
      const f = measure(ctx, fs, opt, { maxWidth: cw - pad - 24, maxLines: 2, maxSize: L.portrait ? 34 : 32, minSize: 18, weight: 'bold', lineHeight: 1.35 });
      ctx.fillStyle = fg;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, f, x + cw - pad, y + ch / 2 - f.height / 2);
      ctx.restore();
    });
  });
  if (answer < 0) return;
  // Countdown ring with the current digit.
  const ct = progress(frame, c0, QUIZ_COUNTDOWN);
  if (frame < c0 - 10 || frame > revealAt + 30) return;
  const cx = L.portrait ? L.W / 2 : L.M + counterW / 2 - 10;
  const cy = L.portrait ? L.H - L.M - counterH / 2 : y0 + (ch * rows + gap * (rows - 1)) / 2;
  const R = 62;
  const fade = frame > revealAt ? 1 - progress(frame, revealAt, 30) : easeOutCubic(progress(frame, c0 - 10, 10));
  withAlpha(ctx, fade, () => {
    ctx.lineWidth = 10;
    ctx.strokeStyle = alpha(theme.foreground, 0.12);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = theme.accent;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ct));
    ctx.stroke();
    const sec = Math.max(1, 3 - Math.floor((frame - c0) / 30));
    ctx.fillStyle = theme.foreground;
    ctx.font = font(fs, 'bold', 64);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frame >= revealAt ? '✓' : localizeDigits(String(sec), digits), cx, cy + 4);
    ctx.textBaseline = 'alphabetic';
  });
}
