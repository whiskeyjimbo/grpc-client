/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';

/**
 * EmptyState — the standard dashed-border placeholder for empty lists.
 *
 * Used in VariableEditor, InlineTierEditor, HistoryScreen (no results),
 * and WorkspaceScreen (no schema). Renders an optional icon, message,
 * and a single primary CTA button.
 *
 * Size variants:
 *   sm — py-6 px-4 (compact inline, e.g. inside a card row)
 *   md — py-10 px-6 (default, e.g. VariableEditor empty)
 *   lg — py-16 px-8 (full-panel empty state, e.g. WorkspaceScreen)
 */
export function EmptyState({
  icon,
  message,
  cta,
  size = 'md',
}: {
  icon?: ReactNode;
  message: string;
  cta?: { label: ReactNode; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
}) {
  const padding = size === 'sm' ? 'py-6 px-4' : size === 'lg' ? 'py-16 px-8' : 'py-10 px-6';

  return (
    <div
      className={`border-2 border-dashed border-outline-variant/20 rounded ${padding} flex flex-col items-center gap-4 text-center`}
    >
      {icon && <div className="text-outline/25">{icon}</div>}
      <p className="text-xs italic text-outline">{message}</p>
      {cta && (
        <button
          onClick={cta.onClick}
          className="flex items-center gap-1.5 px-4 py-1.5 border border-outline-variant/30 text-xs font-bold rounded hover:bg-surface-container-high transition-colors"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
