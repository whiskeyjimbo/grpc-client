/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface SegmentedControlProps<T extends string> {
  options: { id: T; label: string; icon?: React.ElementType }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * SegmentedControl — a mode switcher with a sliding active background.
 * Best for binary or small-set mode switches (e.g., Variables vs. Headers).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative flex items-center bg-surface-container-high/50 border border-outline-variant/20 rounded-lg p-1 ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.id)}
            className={`type-btn relative flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md transition-colors z-10 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/50 outline-none ${
              isActive ? 'text-on-surface' : 'text-outline hover:text-on-surface-variant'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="active-segment"
                className="absolute inset-0 bg-surface-container-highest rounded-md shadow-sm border border-outline-variant/30"
                transition={{ type: 'spring', bounce: 0.1, duration: 0.3 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {Icon && <Icon size={12} className={isActive ? 'text-primary' : 'text-outline/50 group-hover:text-outline transition-colors'} />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
