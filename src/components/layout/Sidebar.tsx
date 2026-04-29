/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, Layers, History as HistoryIcon, Tag, Settings as SettingsIcon, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType } from '../../types.ts';
import { ThemeSwitcher } from './ThemeSwitcher.tsx';

export function Sidebar({
  activeView,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  activeThemeId,
  onThemeChange,
  onOpenHelp,
}: {
  activeView: ViewType,
  onNavigate: (v: ViewType) => void,
  isCollapsed: boolean,
  onToggleCollapse: () => void,
  activeThemeId: string,
  onThemeChange: (id: string) => void,
  onOpenHelp: () => void,
}) {
  const navItems = [
    { id: 'definitions', label: 'Definitions', icon: BookOpen },
    { id: 'workspace', label: 'Workbench', icon: Layers },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'environments', label: 'Variables', icon: Tag },
    { id: 'config', label: 'Config', icon: SettingsIcon },
  ];

  return (
    <motion.nav
      animate={{
        width: window.innerWidth < 768
          ? isCollapsed ? 0 : 200
          : isCollapsed ? 64 : 200,
        x: window.innerWidth < 768 && isCollapsed ? -200 : 0
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`hidden md:flex border-r border-outline-variant/30 bg-surface-container-lowest flex-col pt-6 shrink-0 h-full overflow-x-hidden overflow-y-auto custom-scrollbar relative z-[60]`}
    >
      <ul className="flex-1 space-y-1">
        {navItems.map((item) => (
          <li key={item.id} className="relative group/nav">
            <button
              onClick={() => onNavigate(item.id as ViewType)}
              className={`w-full flex items-center justify-start px-[23px] py-2 transition-colors group relative outline-none ${
                activeView === item.id
                  ? 'text-primary'
                  : 'text-outline hover:text-on-surface hover:bg-surface-container-high/50'
              }`}
            >
               {activeView === item.id && (
                 <>
                    <motion.div
                      layoutId="active-nav-bg"
                      className="absolute inset-y-0 inset-x-2 bg-primary/10 rounded-sm"
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.div
                      layoutId="active-nav-dot"
                      className="absolute w-1.5 h-1.5 bg-primary shrink-0 top-1/2"
                      style={{ rotate: 45, y: '-50%' }}
                      animate={{ right: isCollapsed ? 6 : 12 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                 </>
               )}
               <div className="relative shrink-0">
                 <item.icon size={18} />
               </div>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="font-sans text-xs font-semibold tracking-wide uppercase ml-3 whitespace-nowrap overflow-hidden"
                    >
                       {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

               {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1.5 bg-surface-container-highest border border-outline-variant/30 rounded type-label text-on-surface pointer-events-none opacity-0 group-hover/nav:opacity-100 group-focus-within/nav:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
                    {item.label}
                  </div>
               )}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-outline-variant/10 p-2 flex flex-col gap-0.5">
        <ThemeSwitcher activeThemeId={activeThemeId} onThemeChange={onThemeChange} isCollapsed={isCollapsed} />
        <div className="relative group/help">
          <button
            onClick={onOpenHelp}
            className="w-full h-[34px] flex items-center justify-start px-[15px] text-outline hover:text-on-surface hover:bg-surface-container-high/50 rounded transition-colors"
            aria-label="Open reference panel"
          >
            <div className="shrink-0 flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center flex-1 ml-2"
                >
                  <span className="font-sans text-xs font-semibold tracking-wide uppercase whitespace-nowrap text-outline">
                    Help
                  </span>
                  <kbd className="ml-auto text-[11px] bg-outline-variant/15 px-1.5 py-px rounded border border-outline-variant/30 text-outline/50 font-mono">?</kbd>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1.5 bg-surface-container-highest border border-outline-variant/30 rounded type-label text-on-surface pointer-events-none opacity-0 group-hover/help:opacity-100 group-focus-within/help:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
              Help <kbd className="text-[11px] font-mono ml-1 opacity-60">?</kbd>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="w-full h-[34px] flex items-center justify-center p-2 text-outline hover:text-on-surface hover:bg-surface-container-high/50 rounded transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </motion.nav>
  );
}
