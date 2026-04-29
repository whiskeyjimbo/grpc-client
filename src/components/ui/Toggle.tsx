/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';

/**
 * Toggle — animated pill switch.
 *
 * Size variants:
 *   sm — w-8  h-4, thumb 12×12, travel 16px  (used in compact sidebar / card rows)
 *   md — w-10 h-5, thumb 16×16, travel 20px  (used in settings panels)
 *
 * Color: supply a Tailwind bg-* class that applies when checked.
 * Defaults to `bg-primary` for primary on/off, use `bg-secondary` or `bg-warning` where appropriate.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  activeColor = 'bg-primary',
  size = 'md',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  'aria-label': string;
  /** Tailwind bg-* class applied when checked. Default: 'bg-primary'. */
  activeColor?: string;
  size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  const track = sm
    ? 'w-8 h-4'
    : 'w-10 h-5 after:absolute after:-inset-2 after:content-[\'\']';
  const thumb = sm
    ? { size: 'w-3 h-3', travel: 16 }
    : { size: 'w-4 h-4', travel: 20 };

  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={[
        'rounded-full relative p-0.5 transition-colors shrink-0',
        track,
        checked ? activeColor : 'bg-outline-variant/20',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <motion.div
        animate={{ x: checked ? thumb.travel : 0 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className={`${thumb.size} bg-on-surface rounded-full shadow-sm`}
      />
    </button>
  );
}
