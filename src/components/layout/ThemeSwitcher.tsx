/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PALETTES } from '../../lib/themes.ts';

export function ThemeSwitcher({ activeThemeId, onThemeChange, isCollapsed }: {
  activeThemeId: string;
  onThemeChange: (id: string) => void;
  isCollapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ bottom: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      const outsidePanel = !panelRef.current?.contains(target);
      const outsideBtn = !btnRef.current?.contains(target);
      if (outsidePanel && outsideBtn) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPanelPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 12 });
    }
    setOpen(o => !o);
  };

  const active = PALETTES.find(p => p.id === activeThemeId) ?? PALETTES[0];

  const paletteList = (
    <>
      <p className="type-eyebrow text-outline/60 mb-2.5">Theme</p>
      <div className="flex flex-col gap-0.5">
        {PALETTES.map(p => {
          const isActive = p.id === activeThemeId;
          return (
            <button
              key={p.id}
              onClick={() => { onThemeChange(p.id); setOpen(false); }}
              title={p.name}
              className={`flex flex-row items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors ${isActive ? 'bg-surface-container' : 'hover:bg-surface-container'}`}
            >
              <span
                className="w-4 h-4 rounded-full shrink-0 transition-all"
                style={{
                  backgroundColor: p.swatch,
                  boxShadow: isActive
                    ? `0 0 0 2px var(--color-surface-container-highest), 0 0 0 3.5px ${p.swatch}`
                    : 'none',
                }}
              />
              <span className="type-label text-on-surface-variant/70 whitespace-nowrap">{p.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  const portalPanel = (
    <motion.div
      key="theme-panel-portal"
      ref={panelRef}
      initial={{ opacity: 0, x: -6, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -6, scale: 0.97 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: 'fixed', bottom: panelPos.bottom, left: panelPos.left, zIndex: 9999 }}
      className="w-40 bg-surface-container-highest border border-outline-variant/30 rounded-lg p-3 shadow-2xl"
    >
      {paletteList}
    </motion.div>
  );

  return (
    <div className="relative">
      {createPortal(
        <AnimatePresence>{open && portalPanel}</AnimatePresence>,
        document.body
      )}
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-full h-[34px] flex items-center justify-start px-[15px] text-outline hover:text-on-surface hover:bg-surface-container-high/50 rounded transition-colors"
        aria-label={`Color theme: ${active.name}`}
        title={isCollapsed ? `Theme: ${active.name}` : undefined}
      >
        <div className="w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: active.swatch }} />
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center flex-1 ml-2"
            >
              <span className="font-sans text-xs font-semibold tracking-wide uppercase whitespace-nowrap text-on-surface-variant">Theme</span>
              <span className="ml-auto inline-flex items-center justify-center bg-outline-variant/15 px-1.5 py-px rounded border border-outline-variant/30">
                <motion.span
                  animate={{ rotate: open ? -90 : 0 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex items-center text-outline/50"
                >
                  <ChevronRight size={10} />
                </motion.span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
