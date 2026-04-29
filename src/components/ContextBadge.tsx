/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { motion } from 'motion/react';

/**
 * ContextBadge — compact entity tag with icon + label.
 *
 * The `type-label` + colored background chip repeated across workspace/environment
 * identifiers in PanelHeaders, ContextBar, HistoryScreen table rows, etc.
 *
 * Built-in roles:
 *   workspace — primary color  (amber / cobalt depending on theme)
 *   environment — secondary color  (sage green)
 *   neutral — surface-container-highest with muted outline text
 *   custom — supply colorClass yourself
 */
export type BadgeRole = 'workspace' | 'environment' | 'neutral' | 'custom';

const ROLE_CLASSES: Record<BadgeRole, string> = {
  workspace:   'text-primary   bg-primary/10   border-primary/20',
  environment: 'text-secondary bg-secondary/10 border-secondary/20',
  neutral:     'text-outline   bg-surface-container-highest border-outline-variant/20',
  custom:      '',
};

export function ContextBadge({
  icon,
  label,
  role = 'neutral',
  colorClass,
}: {
  icon?: ReactNode;
  label: ReactNode;
  role?: BadgeRole;
  /** Override for 'custom' role — provide a full Tailwind color set: `text-* bg-* border-*`. */
  colorClass?: string;
}) {
  const cls = role === 'custom' && colorClass ? colorClass : ROLE_CLASSES[role];
  return (
    <motion.span
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`type-label px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${cls}`}
    >
      {icon && <span className="shrink-0 leading-none">{icon}</span>}
      {label}
    </motion.span>
  );
}
