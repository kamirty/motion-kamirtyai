import type { Ctx2D } from '../engine/renderer/context';

/**
 * Minimal recording 2D context for Node tests. measureText approximates glyph width
 * from the font size so wrapping logic is exercised deterministically.
 */
export function createFakeCtx(): { ctx: Ctx2D; ops: string[] } {
  const ops: string[] = [];
  const state: Record<string, unknown> = { font: '400 16px sans-serif', globalAlpha: 1, textBaseline: 'alphabetic', direction: 'ltr' };
  const fontSize = () => Number(/(\d+)px/.exec(String(state.font))?.[1] ?? 16);
  const fmt = (a: unknown) => (typeof a === 'number' ? a.toFixed(2) : JSON.stringify(a));
  const gradient = () => ({ addColorStop: (o: number, c: string) => ops.push(`stop(${fmt(o)},${c})`) });
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'measureText') return (text: string) => ({ width: [...text].length * fontSize() * 0.5 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...args: unknown[]) => {
          ops.push(`${prop}(${args.map(fmt).join(',')})`);
          return gradient();
        };
      }
      if (prop in state) return state[prop];
      return (...args: unknown[]) => {
        ops.push(`${prop}(${args.map(fmt).join(',')})`);
      };
    },
    set(_t, prop: string, value) {
      state[prop] = value;
      ops.push(`${prop}=${fmt(value)}`);
      return true;
    },
  };
  return { ctx: new Proxy({}, handler) as Ctx2D, ops };
}

/** Text drawn by fillText calls, in order. */
export const drawnText = (ops: string[]): string[] =>
  ops.filter((o) => o.startsWith('fillText(')).map((o) => JSON.parse(`[${o.slice(9, -1)}]`)[0] as string);
