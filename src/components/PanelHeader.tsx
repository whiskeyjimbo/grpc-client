/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';

/**
 * PanelHeader — the standard 40px screen-level toolbar strip.
 *
 * Layout: icon + title + optional context badges on the left,
 *         optional actions on the right.
 *
 * Matches the `h-10 border-b border-outline-variant/30 flex items-center
 * justify-between px-4 bg-surface-container-low` pattern repeated across
 * every screen (Definitions, History, Workbench, Variables, Connection).
 */
export function PanelHeader({
  icon,
  title,
  context,
  actions,
}: {
  /** Small icon element shown before the title. */
  icon?: ReactNode;
  /** Primary title text — rendered with `type-label text-outline`. */
  title: ReactNode;
  /** Badges / chips inserted between title and the right-side actions. */
  context?: ReactNode;
  /** Right-aligned action buttons. */
  actions?: ReactNode;
}) {
  return (
    <div className="h-10 border-b border-outline-variant/30 flex items-center justify-between px-4 bg-background shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className="text-on-surface-variant/90 shrink-0">{icon}</span>}
        <div className="min-w-0 truncate">
          {title}
        </div>
        {context && (
          <>
            <div className="w-px h-3 bg-outline-variant/30 shrink-0" />
            <div className="flex items-center gap-2">{context}</div>
          </>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
