/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';

/**
 * CodeBlock — pre-formatted monospace content container.
 *
 * Used for JSON payloads, grpcurl / curl command previews, and any other
 * verbatim text that should sit in the `surface-container-lowest` well
 * with a subtle border and horizontal scroll.
 *
 * The `minHeight` prop is useful for payload panels that should hold their
 * shape even when empty (`min-h-[140px]`).
 */
export function CodeBlock({
  children,
  minHeight,
  className,
}: {
  children: ReactNode;
  /** Optional CSS min-height value, e.g. '140px'. */
  minHeight?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        'bg-surface-container-lowest rounded-lg p-4 font-mono text-[11px]',
        'border border-outline-variant/20 overflow-x-auto custom-scrollbar',
        className ?? '',
      ].join(' ')}
      style={minHeight ? { minHeight } : undefined}
    >
      {children}
    </div>
  );
}
