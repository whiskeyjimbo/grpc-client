/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, Layers, History as HistoryIcon, Tag, Settings as SettingsIcon } from 'lucide-react';
import { ViewType } from '../../types.ts';

export function BottomNav({ activeView, onNavigate }: { activeView: ViewType; onNavigate: (v: ViewType) => void }) {
  const navItems = [
    { id: 'definitions', label: 'Defs', icon: BookOpen },
    { id: 'workspace', label: 'Work', icon: Layers },
    { id: 'history', label: 'Hist', icon: HistoryIcon },
    { id: 'environments', label: 'Vars', icon: Tag },
    { id: 'config', label: 'Conf', icon: SettingsIcon },
  ];

  return (
    <nav className="md:hidden landscape:hidden h-16 border-t border-outline-variant/30 bg-surface-container-low flex items-center justify-around px-2 safe-area-bottom shrink-0 z-50">
      {navItems.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as ViewType)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors outline-none ${
              isActive ? 'text-primary' : 'text-outline hover:text-on-surface'
            }`}
          >
            <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
              <item.icon size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
