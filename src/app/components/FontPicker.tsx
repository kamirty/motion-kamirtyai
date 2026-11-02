import { useEffect, useRef, useState } from 'react';
import { FONTS, FONT_GROUPS, cssFamily, fontById } from '../../design/fonts';

const name = (label: string) => label.split(' (')[0];
const SAMPLE = 'أبجد ١٢٣';

/**
 * «الخط»: a drop-down list of the fonts, grouped, each written in its own face so it can be
 * chosen by sight. Keyboard: Enter/Space/↓ opens, ↑/↓ move, Enter picks, Esc closes.
 */
export function FontPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(value);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = fontById(value);
  // Menu order: by group, so arrow keys follow what is on screen.
  const ordered = FONT_GROUPS.flatMap((g) => FONTS.filter((f) => f.group === g.id));

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-id="${focus}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, focus]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = ordered.findIndex((f) => f.id === focus);
    if (e.key === 'Escape') {
      if (open) e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setFocus(value);
        setOpen(true);
        return;
      }
      const next = ordered[(i + (e.key === 'ArrowDown' ? 1 : ordered.length - 1)) % ordered.length];
      setFocus(next.id);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) pick(focus);
      else {
        setFocus(value);
        setOpen(true);
      }
    }
  };

  return (
    <div className="font-picker" ref={box} onKeyDown={onKey}>
      <button
        type="button"
        className="font-current"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="font-label font-current-name"
        onClick={() => {
          setFocus(value);
          setOpen((o) => !o);
        }}
      >
        <span id="font-current-name" style={{ fontFamily: cssFamily(current) }}>{name(current.label)}</span>
        <span className="font-sample" style={{ fontFamily: cssFamily(current) }} aria-hidden="true">{SAMPLE}</span>
        <span className="chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="font-menu" role="listbox" aria-labelledby="font-label" ref={list} aria-activedescendant={`font-opt-${focus}`} tabIndex={-1}>
          {FONT_GROUPS.map((g) => (
            <li key={g.id} role="presentation">
              <div className="font-group" role="presentation">{g.label}</div>
              <ul role="group" aria-label={g.label}>
                {FONTS.filter((f) => f.group === g.id).map((f) => (
                  <li
                    key={f.id}
                    id={`font-opt-${f.id}`}
                    data-id={f.id}
                    role="option"
                    aria-selected={f.id === value}
                    className={`${f.id === value ? 'active' : ''} ${f.id === focus ? 'focus' : ''}`}
                    onPointerEnter={() => setFocus(f.id)}
                    onClick={() => pick(f.id)}
                  >
                    <span style={{ fontFamily: cssFamily(f) }}>{name(f.label)}</span>
                    <span className="font-sample" style={{ fontFamily: cssFamily(f) }} aria-hidden="true">{SAMPLE}</span>
                    {f.id === value && <span className="tick" aria-hidden="true">✓</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
