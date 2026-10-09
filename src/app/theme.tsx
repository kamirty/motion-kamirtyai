import { useEffect, useState } from 'react';

export type UiTheme = 'light' | 'dark';

const KEY = 'kamirty-motion:ui-theme';

/** Starts light like www.kamirtyai.com unless the visitor picked dark before. */
function initialTheme(): UiTheme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function useUiTheme() {
  const [theme, setTheme] = useState<UiTheme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0d0d' : '#000000');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* preference is a convenience only */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

/** Pill switch matching the blog's night-mode toggle. */
export function ThemeToggle({ theme, onToggle }: { theme: UiTheme; onToggle: () => void }) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle ${dark ? 'on' : ''}`}
      role="switch"
      aria-checked={dark}
      aria-label="الوضع الليلي"
      title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
      onClick={onToggle}
    >
      <span className="knob">{dark ? '☾' : '☀'}</span>
    </button>
  );
}
