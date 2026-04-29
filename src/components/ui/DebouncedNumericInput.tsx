/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, type ChangeEvent } from 'react';

export function DebouncedNumericInput({
  value,
  onChange,
  min = 0,
  max,
  label,
  unit,
  className = "",
  theme = "primary",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  className?: string;
  theme?: "primary" | "secondary";
}) {
  const [localValue, setLocalValue] = useState(value.toString());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const parsed = parseInt(newVal, 10);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
        onChange(clamped);
      }
    }, 500);
  };

  const focusClass = theme === "primary" ? "focus:border-primary focus:ring-primary/20" : "focus:border-secondary focus:ring-secondary/20";
  const borderClass = theme === "primary" ? "border-outline-variant/30" : "border-secondary/20";

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
          className={`text-[10px] uppercase font-black tracking-widest ${theme === "primary" ? "text-outline/60" : "text-secondary/60"}`}
        >
          {label}
        </label>
      )}
      <div className="relative group">
        <input
          id={label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined}
          type="number"
          min={min}
          max={max}
          value={localValue}
          onChange={handleChange}
          aria-label={!label ? (unit ? `${unit} value` : "Numeric value") : undefined}
          className={`w-full bg-surface-container border ${borderClass} rounded-xl px-3 py-2.5 text-[13px] font-mono font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm ${focusClass}`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-outline/30 group-focus-within:text-outline/60 transition-colors">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
