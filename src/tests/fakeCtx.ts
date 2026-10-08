import type { Ctx2D } from '../engine/renderer/context';

/**
 * Minimal recording 2D context for Node tests. measureText approximates glyph width
 * from the font size so wrapping logic is exercised deterministically.
 */
export function createFakeCtx(): { ctx: Ctx2D; ops: string[] } {
  const ops: string[] = [];
  const state: Record<string, unknown> = { font: '400 16px sans-serif', globalAlpha: 1 };
  const fontSize = () => Number(/(\d+)px/.exec(String(state.font))?.[1] ?? 16);
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'measureText') {
        return (text: string) => ({ width: text.length * fontSize() * 0.5 });
      }
      if (prop in state) return state[prop];
      return (...args: unknown[]) => {
        ops.push(`${prop}(${args.map((a) => (typeof a === 'number' ? a.toFixed(3) : JSON.stringify(a))).join(',')})`);
      };
    },
    set(_t, prop: string, value) {
      state[prop] = value;
      ops.push(`${prop}=${typeof value === 'number' ? value.toFixed(3) : JSON.stringify(value)}`);
      return true;
    },
  };
  return { ctx: new Proxy({}, handler) as Ctx2D, ops };
}
