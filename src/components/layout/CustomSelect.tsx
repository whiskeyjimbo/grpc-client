/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function CustomSelect({
  value,
  options,
  onChange,
  colorClass,
  ariaLabel
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
  colorClass: string;
  ariaLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-container transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary`}
      >
        <span className={`text-[11px] font-bold ${colorClass} truncate max-w-[140px]`}>{selected.name}</span>
        <ChevronDown size={10} className={`${colorClass} opacity-50 shrink-0`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 mt-1 z-[100] bg-surface-container-highest border border-outline-variant/30 rounded-lg shadow-2xl py-1.5 min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar"
            role="listbox"
          >
            {options.map(opt => (
              <button
                key={opt.id}
                role="option"
                aria-selected={opt.id === value}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold transition-colors text-left ${
                  opt.id === value
                    ? `text-on-surface bg-primary/10`
                    : `text-on-surface-variant hover:bg-surface-container hover:text-on-surface`
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {opt.id === value && <Check size={10} className={colorClass} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
