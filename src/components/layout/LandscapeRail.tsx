/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, Layers, History as HistoryIcon, Tag, Settings as SettingsIcon } from 'lucide-react';
import { ViewType } from '../../types.ts';

export function LandscapeRail({ activeView, onNavigate }: { activeView: ViewType; onNavigate: (v: ViewType) => void }) {
  const navItems = [
    { id: 'definitions', icon: BookOpen },
    { id: 'workspace', icon: Layers },
    { id: 'history', icon: HistoryIcon },
    { id: 'environments', icon: Tag },
    { id: 'config', icon: SettingsIcon },
  ];

  return (
    <nav className="hidden landscape:flex md:landscape:hidden w-12 border-r border-outline-variant/30 bg-surface-container-low flex-col items-center py-2 gap-2 safe-area-left shrink-0 z-50">
      {navItems.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as ViewType)}
            className={`p-2.5 rounded-xl transition-colors outline-none ${
              isActive ? 'bg-primary/10 text-primary' : 'text-outline hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <item.icon size={18} />
          </button>
        );
      })}
    </nav>
  );
}
