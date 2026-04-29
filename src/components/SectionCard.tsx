/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';

/**
 * SectionCard — the standard bordered settings panel.
 *
 * Used in ConnectionPolicy (Workspace Default, Environment Override),
 * SettingsScreen (VariableEditor sections), and any future settings panels.
 *
 * Structure:
 *   SectionCard (border + rounded)
 *     SectionCard.Header (px-5 py-3 bg-surface-container border-b)
 *     body (children)
 *
 * The `header` prop receives the rendered header row; the component
 * handles the container and the divider.
 */
export function SectionCard({
  header,
  children,
  className,
  disabled,
  disabledMessage,
}: {
  /** Rendered content of the `px-5 py-3 bg-surface-container border-b` header row. */
  header: ReactNode;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  return (
    <div className={`bg-surface-container-low border border-outline-variant/30 rounded overflow-hidden relative ${className ?? ''}`}>
      <div className={`px-5 py-3 bg-surface-container border-b border-outline-variant/30 flex items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
        {header}
      </div>
      <div className={disabled ? 'opacity-30 pointer-events-none grayscale-[0.5]' : ''}>
        {children}
      </div>
      {disabled && disabledMessage && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-10 pointer-events-none">
          <div className="bg-surface-container-highest/90 backdrop-blur-sm border border-outline-variant/50 rounded-lg px-4 py-2 shadow-xl">
             <p className="text-[11px] font-bold text-on-surface uppercase tracking-widest text-center">{disabledMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
