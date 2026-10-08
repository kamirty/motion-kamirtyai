import { createElement } from 'react';
import { iconById } from '../../design/icons';

/** Renders a catalogue icon as inline SVG (same geometry the video renderer draws). */
export function Icon({ id, size = 20 }: { id: string; size?: number }) {
  const icon = iconById(id);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icon?.node.map(([tag, attrs], i) => createElement(tag, { key: i, ...(attrs as object) }))}
    </svg>
  );
}
