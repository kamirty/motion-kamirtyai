import { useMemo, useState } from 'react';
import { searchIcons } from '../../design/icons';
import { Icon } from './Icon';

/**
 * Icon chooser. `compact` shows only the current icon (for per-element rows); `onAuto` adds an
 * «تلقائي» choice that returns the element to its automatically matched icon.
 */
export function IconPicker({ value, onChange, compact = false, onAuto, isAuto = false, label = 'تغيير الأيقونة' }: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
  onAuto?: () => void;
  isAuto?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchIcons(query), [query]);
  return (
    <div className={`icon-picker ${compact ? 'compact' : ''}`}>
      <button type="button" className={`icon-current ${isAuto ? 'auto' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={compact ? `${label}${isAuto ? ' (تلقائية)' : ''}` : undefined} aria-label={compact ? label : undefined}>
        <Icon id={value} size={compact ? 20 : 22} />
        {!compact && <span>{open ? 'إغلاق' : label}</span>}
      </button>
      {open && (
        <div className="icon-pop">
          <input type="search" placeholder="ابحث: ماء، صحة، تعليم…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          {onAuto && (
            <button type="button" className={`ghost icon-auto ${isAuto ? 'active' : ''}`} onClick={() => { onAuto(); setOpen(false); }}>
              ✨ تلقائي (حسب كلمات العنصر)
            </button>
          )}
          <div className="icon-grid">
            {results.map((i) => (
              <button
                type="button"
                key={i.id}
                className={i.id === value ? 'active' : ''}
                title={i.keywords.slice(0, 3).join('، ')}
                onClick={() => {
                  onChange(i.id);
                  setOpen(false);
                }}
              >
                <Icon id={i.id} size={22} />
              </button>
            ))}
            {!results.length && <p className="muted">لا توجد نتائج</p>}
          </div>
        </div>
      )}
    </div>
  );
}
