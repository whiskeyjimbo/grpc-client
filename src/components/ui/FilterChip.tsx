/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FC } from 'react';

/**
 * FilterChip — a pressable toggle pill for filter bars.
 *
 * Used in HistoryScreen (status + date filters) and SettingsScreen
 * (tier filter). 
 */
export const FilterChip: FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  /**
   * Tailwind classes for the active (pressed) state.
   * Defaults to the neutral `bg-outline/15 text-on-surface border-outline/30`.
   *
   * Named presets:
   *   success   → 'bg-success/15 text-success border-success/30'
   *   error     → 'bg-error/15   text-error   border-error/30'
   *   warning   → 'bg-warning/15 text-warning border-warning/30'
   *   primary   → 'bg-primary/10  text-primary  border-primary/20'
   *   secondary → 'bg-secondary/10 text-secondary border-secondary/20'
   *   tertiary  → 'bg-tertiary/10  text-tertiary  border-tertiary/20'
   */
  activeClass?: string;
  'aria-label'?: string;
}> = ({
  label,
  active,
  onClick,
  activeClass = 'bg-surface-container-highest text-on-surface border-outline-variant/50',
  'aria-label': ariaLabel,
}) => {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      className={[
        'type-btn px-3 py-1 rounded-full border transition-all duration-200 outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
        active
          ? `${activeClass} shadow-sm`
          : 'text-outline border-outline-variant/10 bg-surface-container-low/30 hover:bg-surface-container-low hover:border-outline-variant/30 hover:text-on-surface-variant',
      ].join(' ')}
    >
      {label}
    </button>
  );
};

/**
 * FilterChipGroup — convenience wrapper that renders a labelled row of chips.
 */
export function FilterChipGroup<T extends string>({
  label,
  chips,
  value,
  onChange,
  className = '',
}: {
  label?: string;
  chips: { id: T; label: string; activeClass?: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {label && <span className="type-label text-outline/50 mr-1">{label}</span>}
      <div className="flex items-center gap-1.5">
        {chips.map((chip) => (
          <FilterChip
            key={chip.id}
            label={chip.label}
            active={value === chip.id}
            onClick={() => onChange(chip.id)}
            activeClass={chip.activeClass}
          />
        ))}
      </div>
    </div>
  );
}
