/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export function Tooltip({ children, content, side = 'top' }: { children: React.ReactNode; content: string; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  const [open, setOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const [nudge, setNudge] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePos = () => {
    if (!triggerRef.current) return;
    setTriggerRect(triggerRef.current.getBoundingClientRect());
    setNudge(0);
  };

  React.useLayoutEffect(() => {
    if (open && triggerRect && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const margin = 12;
      if (rect.left < margin) {
        setNudge(margin - rect.left);
      } else if (rect.right > window.innerWidth - margin) {
        setNudge(window.innerWidth - margin - rect.right);
      }
    }
  }, [open, triggerRect]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => { updatePos(); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => { updatePos(); setOpen(true); }}
      onBlur={() => setOpen(false)}
      className="inline-flex"
    >
      {children}
      {open && triggerRect && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[100] px-3 py-2 bg-surface-container-highest border border-outline-variant/30 rounded-lg shadow-2xl text-[11px] text-on-surface-variant leading-relaxed max-w-[240px] pointer-events-none"
          style={{
            left: triggerRect.left + triggerRect.width / 2,
            top: side === 'top' ? triggerRect.top : triggerRect.bottom,
            transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})
                        translateY(${side === 'top' ? '-8px' : '8px'})
                        translateX(${nudge}px)`
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}
