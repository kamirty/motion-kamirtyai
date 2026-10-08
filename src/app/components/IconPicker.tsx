import { useMemo, useState } from 'react';
import { searchIcons } from '../../design/icons';
import { Icon } from './Icon';

export function IconPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchIcons(query), [query]);
  return (
    <div className="icon-picker">
      <button type="button" className="icon-current" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon id={value} size={22} />
        <span>{open ? 'إغلاق' : 'تغيير الأيقونة'}</span>
      </button>
      {open && (
        <div className="icon-pop">
          <input type="search" placeholder="ابحث: ماء، صحة، تعليم…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
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
