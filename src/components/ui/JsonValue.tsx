/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

/**
 * JsonValue — recursive interactive JSON tree renderer.
 *
 * Used in the WorkspaceScreen response panel and in HistoryScreen payload wells.
 */
export function JsonValue({
  label,
  value,
  isLast = false,
  depth = 0,
}: {
  label?: string;
  value: any;
  isLast?: boolean;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const renderLabel = () =>
    label ? <span className="text-tertiary">"{label}"</span> : null;

  if (value === null)
    return (
      <div className="flex items-center gap-1">
        {renderLabel()}{label && ': '}
        <span className="text-outline italic">null{isLast ? '' : ','}</span>
      </div>
    );

  if (Array.isArray(value)) {
    if (value.length === 0)
      return (
        <div className="flex items-center gap-1">
          {renderLabel()}{label && ': '}
          <span>[] {isLast ? '' : ','}</span>
        </div>
      );
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1 group">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse array' : 'Expand array'}
            aria-expanded={isExpanded}
            className="w-5 h-5 flex items-center justify-center -ml-5 text-outline/60 group-hover:text-primary transition-colors"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <div
            className="cursor-pointer flex items-center gap-1"
            onClick={() => setIsExpanded(!isExpanded)}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
          >
            {renderLabel()}{label && ': '}
            <span className="text-on-surface/50">{isExpanded ? '[' : `[ ... ${value.length} items ]`}</span>
          </div>
        </div>
        {isExpanded && (
          <div className="pl-4 border-l border-outline-variant/10 my-0.5 ml-1">
            {value.map((item, i) => (
              <div key={i}>
                <JsonValue value={item} isLast={i === value.length - 1} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
        {isExpanded && <div className="text-on-surface/50">] {isLast ? '' : ','}</div>}
      </div>
    );
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0)
      return (
        <div className="flex items-center gap-1">
          {renderLabel()}{label && ': '}
          <span>{"{}"} {isLast ? '' : ','}</span>
        </div>
      );
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1 group">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse object' : 'Expand object'}
            aria-expanded={isExpanded}
            className="w-5 h-5 flex items-center justify-center -ml-5 text-outline/60 group-hover:text-primary transition-colors"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <div
            className="cursor-pointer flex items-center gap-1"
            onClick={() => setIsExpanded(!isExpanded)}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
          >
            {renderLabel()}{label && ': '}
            <span className="text-on-surface/50">{isExpanded ? '{' : `{ ... ${keys.length} keys }`}</span>
          </div>
        </div>
        {isExpanded && (
          <div className="pl-4 border-l border-outline-variant/10 my-0.5 ml-1">
            {keys.map((key, i) => (
              <Fragment key={key}>
                <JsonValue label={key} value={value[key]} isLast={i === keys.length - 1} depth={depth + 1} />
              </Fragment>
            ))}
          </div>
        )}
        {isExpanded && <div className="text-on-surface/50">{"}"} {isLast ? '' : ','}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {renderLabel()}{label && ': '}
      {typeof value === 'string' && <span className="text-secondary overflow-hidden text-ellipsis">"{value}"{isLast ? '' : ','}</span>}
      {typeof value === 'number' && <span className="text-primary font-bold">{value}{isLast ? '' : ','}</span>}
      {typeof value === 'boolean' && (
        <span className={value ? 'text-success' : 'text-error/80'}>
          {value.toString()}{isLast ? '' : ','}
        </span>
      )}
      {!['string', 'number', 'boolean'].includes(typeof value) && <span>{String(value)}{isLast ? '' : ','}</span>}
    </div>
  );
}
