/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard, Layers, Zap, Activity, Code, ShieldCheck, Settings2, Command, BookOpen } from 'lucide-react';


import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// useFocusTrap
// ---------------------------------------------------------------------------

export function useFocusTrap(
  isActive: boolean,
  onClose?: () => void,
  skipInitialFocus = false,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const FOCUSABLE = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    if (!skipInitialFocus) {
      container.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab') return;

      const focusable: HTMLElement[] = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isActive, onClose, skipInitialFocus]);

  return containerRef;
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  isDanger = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const trapRef = useFocusTrap(isOpen, onCancel);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/85"
          onClick={onCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm bg-surface-container rounded-xl border border-outline-variant/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4">
              <p id="confirm-dialog-title" className="text-sm font-semibold text-on-surface mb-1">{title}</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">{message}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-4">
              <button
                onClick={onCancel}
                className="type-btn px-3 py-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`type-btn px-3 py-1.5 rounded transition-colors active:scale-95 ${
                  isDanger
                    ? 'bg-error/15 text-error hover:bg-error/25 border border-error/20'
                    : 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Modal: single-input name creation dialog
// ---------------------------------------------------------------------------

export function Modal({
  isOpen,
  title,
  placeholder,
  onClose,
  onSubmit,
  existingNames,
}: {
  isOpen: boolean;
  title: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  existingNames?: string[];
}) {
  const [value, setValue] = useState('');
  const trapRef = useFocusTrap(isOpen, onClose, true);

  if (!isOpen) return null;

  const trimmed = value.trim();
  const isDuplicate = !!existingNames && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  const canSubmit = !!trimmed && !isDuplicate;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/85">
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant/30 shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center">
          <h2 id="modal-title" className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-outline hover:text-on-surface transition-colors">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6">
          <label htmlFor="modal-input" className="sr-only">{title}</label>
          <input
            id="modal-input"
            autoFocus
            aria-label={placeholder}
            aria-invalid={isDuplicate}
            aria-describedby={isDuplicate ? 'modal-input-error' : undefined}
            className={`w-full bg-surface-dim border rounded-lg px-4 py-3 text-sm outline-none transition-colors mb-1 ${
              isDuplicate
                ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                : 'border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary'
            }`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
          {isDuplicate && (
            <p id="modal-input-error" className="text-xs text-error mb-4">
              A {title.toLowerCase().replace('create ', '')} with that name already exists.
            </p>
          )}
          {!isDuplicate && <div className="mb-6" />}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 type-btn rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors active:scale-95"
            >
              Cancel
            </button>
            <button
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="px-6 py-2 bg-primary text-on-primary type-btn rounded-lg disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition"
            >
              Create
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HelpPanel: keyboard-accessible reference slide-over
// ---------------------------------------------------------------------------

export function HelpPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const trapRef = useFocusTrap(isOpen, onClose, true);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="help-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[90] bg-background/70"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="help-panel"
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts and reference"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[95] w-[500px] max-w-full bg-surface-container-lowest border-l border-outline-variant/30 flex flex-col shadow-2xl"
          >
            <div className="h-14 border-b border-outline-variant/20 flex items-center justify-between px-6 bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <BookOpen size={18} />
                </div>
                <span className="type-label text-on-surface text-base">Reference</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-outline-variant/10 border border-outline-variant/20">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-outline/60">Close</span>
                  <kbd className="text-[10px] bg-surface-container-highest px-1.5 py-0.5 rounded border border-outline-variant/30 text-outline font-mono leading-none">Esc</kbd>
                </div>
                <button 
                  onClick={onClose} 
                  aria-label="Close reference panel" 
                  className="w-10 h-10 flex items-center justify-center rounded-full text-outline hover:text-on-surface hover:bg-surface-container-high transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8 space-y-12">

              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Keyboard size={14} className="text-primary" />
                  <h2 className="type-eyebrow text-outline">Keyboard Shortcuts</h2>
                </div>
                <div className="space-y-1">
                  {([
                    { keys: ['⌘', '↵'], desc: 'Execute selected method' },
                    { keys: ['⌘', 'K'],  desc: 'Focus method search' },
                    { keys: ['1', '2', '3'], desc: 'Switch response tabs (JSON, grpcurl, cURL)' },
                    { keys: ['?'],       desc: 'Toggle this reference panel' },
                    { keys: ['Esc'],     desc: 'Close overlay, cancel edit, or clear search' },
                  ] as { keys: string[]; desc: string }[]).map(({ keys, desc }) => (
                    <div key={desc} className="flex items-center justify-between py-2.5 border-b border-outline-variant/10 last:border-0">
                      <span className="text-xs text-on-surface-variant leading-relaxed pr-4">{desc}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {keys.map((k) => (
                          <kbd key={k} className="text-[10px] bg-outline-variant/15 px-1.5 py-0.5 rounded border border-outline-variant/30 text-outline font-mono min-w-[1.4em] text-center">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Layers size={14} className="text-primary" />
                  <h2 className="type-eyebrow text-outline">Variable Tier Precedence</h2>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-5 leading-relaxed">
                  When the same key exists in multiple tiers, the highest-precedence value wins.
                </p>
                <div className="grid gap-3">
                  {([
                    { badge: 'OVR', color: 'text-tertiary bg-tertiary/10 border-tertiary/20',   title: 'Override: highest precedence', desc: 'Active only for this workspace + environment combination.' },
                    { badge: 'WS',  color: 'text-primary bg-primary/10 border-primary/20',     title: 'Workspace',                    desc: 'Applies to all environments within this specific workspace.' },
                    { badge: 'ENV', color: 'text-secondary bg-secondary/10 border-secondary/20', title: 'Environment: baseline',       desc: 'Global shared variables available across all workspaces.' },
                  ] as { badge: string; color: string; title: string; desc: string }[]).map(({ badge, color, title, desc }) => (
                    <div key={badge} className="flex gap-4 p-3 rounded-xl bg-surface-container-low/30 border border-outline-variant/10">
                      <span className={`type-btn px-2 py-0.5 rounded-md border shrink-0 h-fit ${color}`}>{badge}</span>
                      <div>
                        <p className="text-xs font-semibold text-on-surface mb-1">{title}</p>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Zap size={14} className="text-primary" />
                  <h2 className="type-eyebrow text-outline">Variable Interpolation</h2>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-4 leading-relaxed">
                  Use <code className="font-mono bg-surface-container px-1.5 py-0.5 rounded text-primary text-[11px]">{'{{VAR_NAME}}'}</code> in any request field, metadata value, or endpoint override.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-success/5 border border-success/10 space-y-2">
                    <span className="type-eyebrow text-success">resolved</span>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Variable found. Value will be substituted before execution.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-error/5 border border-error/10 space-y-2">
                    <span className="type-eyebrow text-error">missing</span>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Variable not defined. The raw placeholder is sent as-is.</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Settings2 size={14} className="text-primary" />
                  <h2 className="type-eyebrow text-outline">Metadata & Headers</h2>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed mb-4">
                  Custom gRPC metadata can be added in the <span className="text-on-surface font-semibold">Active Context</span> bar at the bottom of the workbench. 
                </p>
                <div className="p-4 rounded-xl bg-surface-container-low/30 border border-outline-variant/10 flex items-start gap-3">
                  <ShieldCheck size={14} className="text-secondary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Sensitive keys like <code className="font-mono bg-surface-container px-1 rounded text-[10px]">authorization</code> or <code className="font-mono bg-surface-container px-1 rounded text-[10px]">api-key</code> are automatically masked in command exports and history.
                  </p>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Code size={14} className="text-primary" />
                  <h2 className="type-eyebrow text-outline">Command Line Export</h2>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed mb-4">
                  Every request can be exported to standard tools for sharing or shell testing.
                </p>
                <div className="grid gap-2">
                  {[
                    { label: 'grpcurl', desc: 'Standard gRPC CLI with reflection support.' },
                    { label: 'cURL',    desc: 'Compatible with Connect-protocol servers.' },
                  ].map(t => (
                    <div key={t.label} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/30 border border-outline-variant/10">
                      <span className="text-xs font-bold text-on-surface">{t.label}</span>
                      <span className="text-[10px] text-on-surface-variant opacity-70">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <Activity size={14} className="text-primary" />
                  <h2 className="type-eyebrow text-outline">Response & Status</h2>
                </div>
                <div className="space-y-4">
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    gRPC status codes are displayed with color coding. trailers (metadata sent after the response) are visible in the response panel headers section.
                  </p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">0 OK</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-error" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Error</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="pb-8">
                <div className="flex items-center gap-2.5 mb-4">
                  <Zap size={14} className="text-primary" />
                  <h2 className="type-eyebrow text-outline">Quick Start</h2>
                </div>
                <ol className="space-y-4 list-none">
                  {([
                    { n: '01', step: 'Load definitions', detail: 'Definitions tab: use Server Reflection or import a .proto file.' },
                    { n: '02', step: 'Select a method',  detail: 'Expand a service in the sidebar. Click any method to load its form.' },
                    { n: '03', step: 'Fill & Resolve',   detail: 'Use typed fields. Variables in {{double_braces}} resolve in real time.' },
                    { n: '04', step: 'Execute',          detail: 'Press ⌘↵ or click Execute. View results in the Response panel.' },
                  ] as { n: string; step: string; detail: string }[]).map(({ n, step, detail }) => (
                    <li key={n} className="flex gap-4">
                      <span className="font-mono text-[11px] text-primary/40 shrink-0 w-5 pt-0.5">{n}</span>
                      <div>
                        <p className="text-xs font-semibold text-on-surface mb-1">{step}</p>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">{detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>


            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
