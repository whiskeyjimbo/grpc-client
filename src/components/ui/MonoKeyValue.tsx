/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FC } from 'react';

/**
 * MonoKeyValue — a single key: value row in monospace.
 *
 * Used in history expansion panels for:
 *   - "Variables at request time"  (primary value color)
 *   - "Request Headers"            (secondary value color)
 *   - "Response Trailers"          (tertiary value color)
 *
 * The row always has a bottom border that disappears on the last child,
 * handled by CSS `last:border-0` on the container.
 */
export const MonoKeyValue: FC<{
  label: string;
  value: string;
  /**
   * Tailwind text-* class for the value.
   * Common: 'text-primary', 'text-secondary', 'text-tertiary', 'text-on-surface-variant'
   */
  valueColorClass?: string;
}> = ({ label, value, valueColorClass = 'text-on-surface-variant' }) => {
  return (
    <div className="flex justify-between items-baseline font-mono text-[11px] border-b border-outline-variant/10 pb-1 last:border-0 min-w-0">
      <span className="text-on-surface/80 font-bold shrink-0 mr-2">{label}:</span>
      <span className={`${valueColorClass} truncate`} title={value}>
        {value}
      </span>
    </div>
  );
};
