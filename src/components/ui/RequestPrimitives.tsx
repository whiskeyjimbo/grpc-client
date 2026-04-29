/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, type FC } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import type { EnvVariable, GrpcField } from '../../types.ts';
import { resolveVariables } from '../../lib/utils.ts';

// ---------------------------------------------------------------------------
// SearchInput
// ---------------------------------------------------------------------------

export const SearchInput = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  ariaLabel,
  className = '',
  iconSize = 12,
  inputRef,
  rightElement,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  iconSize?: number;
  inputRef?: React.RefObject<HTMLInputElement>;
  rightElement?: React.ReactNode;
}) => {
  return (
    <div className={`relative group ${className}`}>
      <Search 
        size={iconSize} 
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors pointer-events-none" 
      />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="w-full bg-surface-container border border-outline-variant/30 rounded-lg pl-8 pr-8 py-1.5 text-xs outline-none focus:border-primary transition-all placeholder:text-outline/50"
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value && onClear ? (
          <button
            onClick={onClear}
            aria-label="Clear search"
            className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X size={iconSize} />
          </button>
        ) : rightElement}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ChipTooltip
// ---------------------------------------------------------------------------

export const ChipTooltip: FC<{
  label: string;
  content: string;
  chipCls: string;
}> = ({ label, content, chipCls }) => {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const showTooltip = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setAnchor({ x: r.left, y: r.top });
  };
  return (
    <span
      className={chipCls}
      tabIndex={content ? 0 : undefined}
      aria-label={content || undefined}
      onMouseEnter={(e) => showTooltip(e.currentTarget as HTMLElement)}
      onMouseLeave={() => setAnchor(null)}
      onFocus={(e) => showTooltip(e.currentTarget as HTMLElement)}
      onBlur={() => setAnchor(null)}
    >
      {label}
      {anchor && content && createPortal(
        <span
          className="fixed z-[150] px-2 py-1 bg-surface-container-highest border border-outline-variant/30 rounded text-[11px] font-mono text-on-surface pointer-events-none whitespace-nowrap shadow-xl"
          style={{ left: anchor.x, top: anchor.y - 6, transform: 'translateY(-100%)' }}
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// HighlightedInput
// ---------------------------------------------------------------------------

export const HighlightedInput = React.memo(({
  value,
  onChange,
  placeholder,
  variables,
  type = 'text',
  className = '',
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  variables: EnvVariable[];
  type?: string;
  className?: string;
  ariaLabel?: string;
}) => {
  const { missing } = resolveVariables(value, variables);

  const findVars = (text: string) => {
    const parts: { text: string; isVar: boolean }[] = [];
    const regex = /\{\{[^}]+\}\}/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ text: text.substring(lastIndex, match.index), isVar: false });
      parts.push({ text: match[0], isVar: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ text: text.substring(lastIndex), isVar: false });
    return parts;
  };

  return (
    <div className="relative group">
      <div
        aria-hidden="true"
        className={`absolute inset-0 px-4 py-2 text-xs font-mono pointer-events-none whitespace-pre-wrap ${className}`}
        style={{ color: 'transparent' }}
      >
        {findVars(value).map((part, i) => (
          <span
            key={i}
            className={
              part.isVar
                ? missing.includes(part.text.replace(/[{}]/g, '').trim())
                  ? 'bg-error/25 rounded ring-1 ring-inset ring-error/50'
                  : 'bg-success/20 rounded'
                : ''
            }
          >
            {part.text}
          </span>
        ))}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full bg-surface-container-low border border-outline-variant/50 rounded-lg px-4 py-2 font-mono text-xs focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low outline-none relative z-10 transition-all ${className}`}
        style={{ background: 'transparent' }}
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// DynamicField
// ---------------------------------------------------------------------------

export const DynamicField: FC<{
  field: GrpcField;
  path: string;
  variables: EnvVariable[];
  requestData: Record<string, any>;
  onValueChange: (path: string, value: any) => void;
}> = React.memo(({ field, path, variables, requestData, onValueChange }) => {
  const val = path.split('.').reduce((obj: any, key) => obj?.[key], requestData) ?? '';

  if (field.type === 'message' && field.fields) {
    return (
      <div className="border border-outline-variant/25 rounded-xl bg-surface-container-low/15 overflow-hidden mt-6 mb-4">
        <div className="px-4 py-2 border-b border-outline-variant/15 flex items-center gap-2 bg-surface-container-low/20">
          <span className="text-[10px] font-black uppercase tracking-widest text-outline/40 border border-outline-variant/30 px-1.5 py-0.5 rounded-sm bg-background/50">message</span>
          <span className="font-mono text-xs text-on-surface-variant font-bold">{field.name}</span>
        </div>
        <div className="p-5 space-y-5">
          {field.fields.map((f) => (
            <DynamicField
              key={f.name}
              field={f}
              path={`${path}.${f.name}`}
              variables={variables}
              requestData={requestData}
              onValueChange={onValueChange}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 group/field">
      <div className="w-full sm:w-40 sm:pt-2 sm:text-right relative">
        <span className="font-mono text-xs text-on-surface-variant group-hover/field:text-on-surface group-focus-within/field:text-on-surface transition-colors">
          {field.name}
        </span>
        {field.required && (
          <span className="relative inline-block group/req ml-1" aria-hidden="true">
            <span className="text-error cursor-default text-xs leading-none">*</span>
            <span className="absolute bottom-full right-0 mb-1.5 px-2 py-1 rounded bg-surface-container-highest border border-outline-variant/30 text-on-surface text-[11px] font-sans font-normal normal-case tracking-normal whitespace-nowrap pointer-events-none opacity-0 group-hover/req:opacity-100 transition-opacity duration-150 z-50">
              {field.rules?.includes('required') ? 'Required by validation' : 'Required field'}
            </span>
          </span>
        )}
      </div>
      <div className="flex-1 max-w-xl">
        {field.type === 'enum' && field.enumValues && field.enumValues.length > 0 ? (
          <div className="relative">
            <select
              value={String(val)}
              required={field.required}
              onChange={(e) => onValueChange(path, e.target.value)}
              className={`w-full font-mono text-xs border border-outline-variant/50 rounded-lg px-4 py-2 pr-8 leading-4 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low outline-none appearance-none cursor-pointer transition-all group-hover/field:border-outline-variant bg-surface-container-low ${String(val) === '' ? 'text-outline' : 'text-on-surface'}`}
            >
              <option value="" className="text-outline bg-surface-container-low">Select...</option>
              {field.enumValues.map((v) => (
                <option key={v} value={v} className="text-on-surface bg-surface-container-low">{v}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline/60 pointer-events-none" />
          </div>
        ) : field.type === 'boolean' ? (
          <div className="relative">
            <select
              value={String(val)}
              required={field.required}
              onChange={(e) => onValueChange(path, e.target.value === 'true')}
              className={`w-full font-mono text-xs border border-outline-variant/50 rounded-lg px-4 py-2 pr-8 leading-4 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low outline-none appearance-none cursor-pointer transition-all group-hover/field:border-outline-variant bg-surface-container-low ${String(val) === '' ? 'text-outline' : 'text-on-surface'}`}
            >
              <option value="" className="text-outline bg-surface-container-low">Select...</option>
              <option value="true"  className="text-on-surface bg-surface-container-low">true</option>
              <option value="false" className="text-on-surface bg-surface-container-low">false</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline/60 pointer-events-none" />
          </div>
        ) : (
          <HighlightedInput
            value={String(val)}
            onChange={(v) => onValueChange(path, v)}
            variables={variables}
            placeholder={field.type === 'number' ? '0' : undefined}
            ariaLabel={`${field.name}${field.required ? ' (required)' : ''}`}
            className="group-hover/field:border-outline-variant"
          />
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className="flex items-center gap-1 text-[11px] font-mono text-outline/70">
            {field.type === 'boolean' ? 'bool' : field.type === 'number' ? 'number' : field.type === 'enum' ? 'enum' : field.type}
            {field.rules && field.rules.length > 0 && (
              <span className="w-1 h-1 rounded-full bg-tertiary/50 shrink-0" />
            )}
          </span>
          {field.rules && field.rules.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 opacity-0 group-hover/field:opacity-100 group-focus-within/field:opacity-100 transition-opacity duration-150">
              {field.rules.map((rule) => (
                <span
                  key={rule}
                  className="text-[11px] font-mono px-1.5 py-px rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/30"
                >
                  {rule}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
