/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { X, Terminal as TerminalIcon } from 'lucide-react';
import { ViewType } from '../../types.ts';
import { setDemoMode, isForcedDemoMode } from '../../api/client.ts';
import { SearchInput } from '../ui/index.ts';

export function Header({
  onNavigate,
  searchQuery,
  onSearchQueryChange,
  isMockMode,
  onToggleSidebar,
}: {
  onNavigate: (v: ViewType) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  isMockMode: boolean;
  onToggleSidebar?: () => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-10 md:h-14 border-b border-outline-variant/30 bg-surface-container-low flex justify-between items-center px-3 md:px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3 md:gap-6">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1 rounded hover:bg-surface-container transition-colors text-outline-variant hover:text-on-surface outline-none"
            aria-label="Toggle navigation menu"
          >
            <div className="flex flex-col gap-1 w-4">
              <div className="h-0.5 w-full bg-current rounded-full" />
              <div className="h-0.5 w-full bg-current rounded-full" />
              <div className="h-0.5 w-full bg-current rounded-full" />
            </div>
          </button>
        )}
        <button
          onClick={() => onNavigate('definitions')}
          className="flex items-center gap-2 group/logo outline-none rounded p-0.5"
          aria-label="Go to Definitions"
        >
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center group-hover/logo:scale-105 transition-transform">
            <TerminalIcon size={13} className="text-on-primary" />
          </div>
          <span className="font-display font-bold tracking-tight text-lg group-hover/logo:text-primary transition-colors hidden sm:block">gRPC Client</span>
          <span className="font-display font-bold tracking-tight text-base group-hover/logo:text-primary transition-colors sm:hidden">gRPC</span>
        </button>

        <SearchInput
          inputRef={searchInputRef}
          placeholder="Filter Workbench methods..."
          value={searchQuery}
          onChange={onSearchQueryChange}
          onClear={() => onSearchQueryChange('')}
          ariaLabel="Filter Workbench methods"
          className="hidden md:block w-64"
          rightElement={
            <div className="flex gap-1 items-center px-1.5 shrink-0 pointer-events-none">
              <kbd className="text-[10px] bg-outline-variant/15 px-1 rounded border border-outline-variant/30 text-outline/50 font-mono">⌘</kbd>
              <kbd className="text-[10px] bg-outline-variant/15 px-1 rounded border border-outline-variant/30 text-outline/50 font-mono">K</kbd>
            </div>
          }
        />
      </div>
      <div className="flex items-center gap-3">
        {isMockMode && (
          <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-warning/10 border border-warning/20">
            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
            <span className="text-[10px] font-bold text-warning uppercase tracking-wider">Mock Mode</span>
            <button
              onClick={() => { setDemoMode(false); window.location.reload(); }}
              className="ml-1 hover:text-warning/80 transition-colors hide-in-demo"
              title="Exit Demo Mode"
            >
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        )}
        <div className="h-4 w-px bg-outline-variant/20 mx-1" />
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isMockMode ? 'bg-outline/20' : 'bg-success shadow-[0_0_8px_var(--color-success)]'}`} />
          <span className="text-[10px] font-bold text-outline/50 uppercase tracking-wider">
            {isForcedDemoMode() ? 'Demo Mode' : isMockMode ? 'Backend Offline' : 'Connected'}
          </span>
        </div>
      </div>
    </header>
  );
}
