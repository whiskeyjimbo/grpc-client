/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, Fragment, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Play,
  Globe,
  Network,
  Layers,
  Settings as SettingsIcon,
  History as HistoryIcon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Pencil,
  Terminal as TerminalIcon,
  BookOpen,
  Wifi,
  CloudUpload,
  Server,
  Lock,
  Cpu,
  Braces,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Hash,
  Tag,
  Maximize2,
  Minimize2,
  ArrowDownToLine,
  SaveAll,
  Undo2,
  HelpCircle,
  MoreHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType, GrpcService, GrpcMethod, GrpcField, HistoryItem, EnvVariable, MetadataHeader, Workspace, Environment, ConnectionPolicy } from './types.ts';
import { MOCK_HISTORY, MOCK_WORKSPACES, MOCK_ENVIRONMENTS } from './constants.ts';
import { appendHistory, deleteEnvironment, deleteHistory, deleteHistoryBulk, deleteWorkspace, executeRequest, fetchBootstrap, importProtoFiles, reflectDefinitions, upsertEnvironment, upsertWorkspace, isDemoMode, setDemoMode, isForcedDemoMode } from './api.ts';
import { Toggle, ContextBadge, FilterChipGroup, MonoKeyValue, PanelHeader, CodeBlock, SectionCard, EmptyState, SearchInput } from './components/index.ts';
import { DefinitionsScreen } from './components/DefinitionsScreen.tsx';
import { HistoryScreen } from './components/HistoryScreen.tsx';
import { VariablesScreen } from './components/VariablesScreen.tsx';
import { ConfigScreen } from './components/ConfigScreen.tsx';
import { WorkbenchScreen } from './components/WorkbenchScreen.tsx';
import { JsonValue } from './components/JsonValue.tsx';
import { ChipTooltip, HighlightedInput, DynamicField } from './components/RequestPrimitives.tsx';
import { ConfirmDialog, Modal, HelpPanel } from './components/dialogs.tsx';
import { createEntityID, maskValue, isSensitiveKey, resolveVariables, sanitizeRequestDataForFields, getErrorMessage, getLatencyColor, GRPC_STATUS_DESCRIPTIONS, type Toast } from './utils.ts';
import { Palette, PALETTES } from './themes.ts';

// --- Theme Palettes ---

// Apply saved theme immediately to avoid flash on load
{
  const savedId = (() => { try { return localStorage.getItem('grpc-theme') ?? 'amber'; } catch { return 'amber'; } })();
  const savedPalette = PALETTES.find(p => p.id === savedId) ?? PALETTES[0];
  const root = document.documentElement;
  Object.entries(savedPalette.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.classList.add(`theme-${savedId}`);
}

// --- Components ---

function Tooltip({ children, content, side = 'top' }: { children: React.ReactNode; content: string; side?: 'top' | 'right' | 'bottom' | 'left' }) {
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

function Header({
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

function CustomSelect({
  value,
  options,
  onChange,
  colorClass,
  ariaLabel
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
  colorClass: string;
  ariaLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-container transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary`}
      >
        <span className={`text-[11px] font-bold ${colorClass} truncate max-w-[140px]`}>{selected.name}</span>
        <ChevronDown size={10} className={`${colorClass} opacity-50 shrink-0`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 mt-1 z-[100] bg-surface-container-highest border border-outline-variant/30 rounded-lg shadow-2xl py-1.5 min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar"
            role="listbox"
          >
            {options.map(opt => (
              <button
                key={opt.id}
                role="option"
                aria-selected={opt.id === value}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold transition-colors text-left ${
                  opt.id === value 
                    ? `text-on-surface bg-primary/10` 
                    : `text-on-surface-variant hover:bg-surface-container hover:text-on-surface`
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {opt.id === value && <Check size={10} className={colorClass} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContextBar({
  activeWorkspace,
  activeEnvironment,
  workspaces,
  environments,
  onWorkspaceChange,
  onEnvironmentChange,
  onCreateWorkspace,
  onDeleteWorkspace,
  onCreateEnvironment,
  onDeleteEnvironment,
  canDeleteWorkspace,
  canDeleteEnvironment,
  onRenameWorkspace,
  onRenameEnvironment,
}: {
  activeWorkspace: Workspace,
  activeEnvironment: Environment,
  workspaces: Workspace[],
  environments: Environment[],
  onWorkspaceChange: (id: string) => void,
  onEnvironmentChange: (id: string) => void,
  onCreateWorkspace: () => void,
  onDeleteWorkspace: () => void,
  onCreateEnvironment: () => void,
  onDeleteEnvironment: () => void,
  canDeleteWorkspace: boolean,
  canDeleteEnvironment: boolean,
  onRenameWorkspace: (id: string, name: string) => void,
  onRenameEnvironment: (id: string, name: string) => void,
}) {
  const [renamingEntity, setRenamingEntity] = useState<'workspace' | 'environment' | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [overflowOpen, setOverflowOpen] = useState<'workspace' | 'environment' | null>(null);
  const wsOverflowRef = useRef<HTMLDivElement>(null);
  const envOverflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const handle = (e: MouseEvent) => {
      const ref = overflowOpen === 'workspace' ? wsOverflowRef : envOverflowRef;
      if (!ref.current?.contains(e.target as Node)) setOverflowOpen(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [overflowOpen]);

  const startRename = (entity: 'workspace' | 'environment') => {
    setOverflowOpen(null);
    setRenamingEntity(entity);
    setRenameValue(entity === 'workspace' ? activeWorkspace.name : activeEnvironment.name);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && renamingEntity === 'workspace') onRenameWorkspace(activeWorkspace.id, trimmed);
    if (trimmed && renamingEntity === 'environment') onRenameEnvironment(activeEnvironment.id, trimmed);
    setRenamingEntity(null);
  };

  const cancelRename = () => setRenamingEntity(null);

  const EntityOverflow = ({
    entity,
    canDelete,
    onDelete,
    color,
  }: {
    entity: 'workspace' | 'environment';
    canDelete: boolean;
    onDelete: () => void;
    color: string;
  }) => {
    const ref = entity === 'workspace' ? wsOverflowRef : envOverflowRef;
    const isOpen = overflowOpen === entity;
    return (
      <div ref={ref} className="relative shrink-0">
        <button
          onClick={() => setOverflowOpen(isOpen ? null : entity)}
          className="h-11 w-11 flex items-center justify-center rounded text-outline/40 hover:text-on-surface hover:bg-surface-container-high/50 transition-colors"
          aria-label={`${entity} actions`}
          aria-expanded={isOpen}
          title={`${entity === 'workspace' ? 'Workspace' : 'Environment'} actions`}
        >
          <MoreHorizontal size={14} />
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full left-0 mt-1.5 z-50 bg-surface-container-highest border border-outline-variant/30 rounded shadow-xl overflow-hidden min-w-[120px]"
            >
              <button
                onClick={() => startRename(entity)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors text-left`}
              >
                <Pencil size={11} className={color} />
                Rename
              </button>
              <button
                onClick={() => { setOverflowOpen(null); onDelete(); }}
                disabled={!canDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-on-surface-variant hover:text-error hover:bg-error/5 transition-colors text-left disabled:opacity-30 disabled:cursor-not-allowed"
                title={!canDelete ? `Cannot delete the last ${entity}` : undefined}
              >
                <Trash2 size={11} />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-[36px] md:min-h-[40px] py-1.5 md:py-0 border-b border-outline-variant/20 bg-background flex flex-wrap items-center px-3 md:px-4 gap-x-4 md:gap-x-10 gap-y-1 shrink-0">
      <div className="group/ws flex items-center gap-1.5 min-w-0">
        <Tooltip content="Active workspace. WS-tier variables override ENV defaults." side="bottom">
          <span className="type-eyebrow text-outline/60 cursor-default leading-none hidden xs:inline">Workspace</span>
          <Layers size={10} className="xs:hidden text-outline/50" />
        </Tooltip>
        {renamingEntity === 'workspace' ? (
          <input
            autoFocus
            className="bg-surface-container border border-primary rounded px-2 py-1 text-[11px] font-bold text-primary outline-none w-32"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
            }}
            aria-label="Rename workspace"
          />
        ) : (
          <CustomSelect
            value={activeWorkspace.id}
            options={workspaces}
            onChange={onWorkspaceChange}
            colorClass="text-primary"
            ariaLabel="Active workspace"
          />
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/ws:opacity-100 group-focus-within/ws:opacity-100 transition-opacity duration-150 shrink-0">
          <EntityOverflow entity="workspace" canDelete={canDeleteWorkspace} onDelete={onDeleteWorkspace} color="text-primary" />
        </div>
        <button onClick={onCreateWorkspace} className="h-11 w-11 flex items-center justify-center rounded text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors shrink-0 outline-none" aria-label="New workspace" title="New workspace">
          <Plus size={11} />
        </button>
      </div>

      <div className="group/env flex items-center gap-1.5 min-w-0">
        <Tooltip content="Active environment. ENV-tier variables are the shared baseline; WS and OVR tiers override them." side="bottom">
          <span className="type-eyebrow text-outline/60 cursor-default leading-none hidden xs:inline">Environment</span>
          <Tag size={10} className="xs:hidden text-outline/50" />
        </Tooltip>
        {renamingEntity === 'environment' ? (
          <input
            autoFocus
            className="bg-surface-container border border-secondary rounded px-2 py-1 text-[11px] font-bold text-secondary outline-none w-32"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
            }}
            aria-label="Rename environment"
          />
        ) : (
          <CustomSelect
            value={activeEnvironment.id}
            options={environments}
            onChange={onEnvironmentChange}
            colorClass="text-secondary"
            ariaLabel="Active environment"
          />
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/env:opacity-100 group-focus-within/env:opacity-100 transition-opacity duration-150 shrink-0">
          <EntityOverflow entity="environment" canDelete={canDeleteEnvironment} onDelete={onDeleteEnvironment} color="text-secondary" />
        </div>
        <button onClick={onCreateEnvironment} className="h-11 w-11 flex items-center justify-center rounded text-secondary/50 hover:text-secondary hover:bg-secondary/10 transition-colors shrink-0 outline-none" aria-label="New environment" title="New environment">
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}

function BottomNav({ activeView, onNavigate }: { activeView: ViewType; onNavigate: (v: ViewType) => void }) {
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

function LandscapeRail({ activeView, onNavigate }: { activeView: ViewType; onNavigate: (v: ViewType) => void }) {
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

function Sidebar({
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

function ThemeSwitcher({ activeThemeId, onThemeChange, isCollapsed }: {
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








export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('workspace');
  const [replayItem, setReplayItem] = useState<HistoryItem | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(MOCK_WORKSPACES);
  const [environments, setEnvironments] = useState<Environment[]>(MOCK_ENVIRONMENTS);
  const [history, setHistory] = useState<HistoryItem[]>(MOCK_HISTORY);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(MOCK_WORKSPACES[0].id);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>(MOCK_ENVIRONMENTS[0].id);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    try { return localStorage.getItem('grpc-theme') ?? 'amber'; } catch { return 'amber'; }
  });
  const [lastMethodId, setLastMethodId] = useState<string | null>(null);
  const isCurrentlyDemo = isDemoMode();

  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal State
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [pendingDeleteServiceId, setPendingDeleteServiceId] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const bgRef = useRef<HTMLDivElement>(null);
  const anyModalOpen = isWorkspaceModalOpen || isEnvironmentModalOpen || pendingDeleteServiceId !== null || isHelpOpen;

  const activeWorkspace = useMemo(() => workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0], [workspaces, activeWorkspaceId]);
  const activeEnvironment = useMemo(() => environments.find((e) => e.id === activeEnvironmentId) ?? environments[0], [environments, activeEnvironmentId]);

  const effectiveThemeId = activeThemeId;

  useEffect(() => {
    if (!bgRef.current) return;
    if (anyModalOpen) {
      bgRef.current.setAttribute('inert', '');
    } else {
      bgRef.current.removeAttribute('inert');
    }
  }, [anyModalOpen]);

  useEffect(() => {
    const palette = PALETTES.find(p => p.id === effectiveThemeId) ?? PALETTES[0];
    const root = document.documentElement;
    Object.entries(palette.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    
    // Toggle theme classes
    PALETTES.forEach(p => root.classList.remove(`theme-${p.id}`));
    root.classList.add(`theme-${effectiveThemeId}`);
  }, [effectiveThemeId]);

  useEffect(() => {
    const handleHelpKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      setIsHelpOpen(prev => !prev);
    };
    window.addEventListener('keydown', handleHelpKey);
    return () => window.removeEventListener('keydown', handleHelpKey);
  }, []);


  const showToast = (tone: Toast['tone'], message: string, onUndo?: () => void) => {
    setToast({
      id: Date.now() + Math.floor(Math.random() * 1000),
      tone,
      message,
      onUndo,
    });
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 3400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const loadBootstrap = useCallback(async () => {
    try {
      setBootstrapError(null);
      const bootstrap = await fetchBootstrap();
      
      if (bootstrap.workspaces.length > 0) {
        setWorkspaces(bootstrap.workspaces);
        setActiveWorkspaceId((current) => (
          bootstrap.workspaces.some((workspace) => workspace.id === current)
            ? current
            : bootstrap.workspaces[0].id
        ));
        const firstWs = bootstrap.workspaces[0];
        if (firstWs && firstWs.services.length === 0) {
          setActiveView('definitions');
        }
      }

      if (bootstrap.environments.length > 0) {
        setEnvironments(bootstrap.environments);
        setActiveEnvironmentId((current) => (
          bootstrap.environments.some((environment) => environment.id === current)
            ? current
            : bootstrap.environments[0].id
        ));
      }

      if (bootstrap.history.length > 0) {
        setHistory(bootstrap.history);
      }
    } catch (error) {
      setBootstrapError(`Using local mock data. Backend sync failed: ${getErrorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const handleCreateEnvironment = (name: string) => {
    const newEnv: Environment = {
      id: createEntityID('env'),
      name,
      variables: [],
      headers: []
    };
    
    setEnvironments(prev => [...prev, newEnv]);
    setActiveEnvironmentId(newEnv.id);
    setIsEnvironmentModalOpen(false);

    void upsertEnvironment(newEnv).then(() => {
      setBootstrapError(null);
    }).catch((error) => {
      setBootstrapError(`Failed to persist environment: ${getErrorMessage(error)}`);
    });
  };

  const handleCreateWorkspace = (name: string) => {
    const newWs: Workspace = {
      id: createEntityID('ws'),
      name,
      variables: [],
      headers: [],
      services: [],
      envOverrides: {}
    };

    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
    setIsWorkspaceModalOpen(false);

    void upsertWorkspace(newWs).then(() => {
      setBootstrapError(null);
    }).catch((error) => {
      setBootstrapError(`Failed to persist workspace: ${getErrorMessage(error)}`);
    });
  };

  const handleRenameWorkspace = (id: string, name: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (ws) handleUpdateWorkspace({ ...ws, name });
  };

  const handleRenameEnvironment = (id: string, name: string) => {
    const env = environments.find(e => e.id === id);
    if (env) handleUpdateEnvironment({ ...env, name });
  };

  const handleUpdateEnvironment = (env: Environment) => {
    setEnvironments(prev => prev.map(e => e.id === env.id ? env : e));

    void upsertEnvironment(env).then(() => {
      setBootstrapError(null);
    }).catch((error) => {
      setBootstrapError(`Failed to persist environment changes: ${getErrorMessage(error)}`);
    });
  };

  const handleUpdateWorkspace = (ws: Workspace) => {
    setWorkspaces(prev => prev.map(w => w.id === ws.id ? ws : w));

    void upsertWorkspace(ws).then(() => {
      setBootstrapError(null);
    }).catch((error) => {
      setBootstrapError(`Failed to persist workspace changes: ${getErrorMessage(error)}`);
    });
  };

  const handleDeleteWorkspace = () => {
    if (workspaces.length <= 1) {
      showToast('error', 'Cannot delete the last workspace.');
      return;
    }
    const workspaceToDelete = activeWorkspace;
    const snapshotWorkspaces = workspaces;
    const fallbackWorkspace = workspaces.find((w) => w.id !== workspaceToDelete.id);
    if (!fallbackWorkspace) return;

    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceToDelete.id));
    setActiveWorkspaceId((current) => current === workspaceToDelete.id ? fallbackWorkspace.id : current);

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      void deleteWorkspace(workspaceToDelete.id).catch((error) => {
        setWorkspaces(snapshotWorkspaces);
        setActiveWorkspaceId(workspaceToDelete.id);
        showToast('error', `Failed to delete workspace: ${getErrorMessage(error)}`);
      });
    }, 5000);

    showToast('success', `Workspace "${workspaceToDelete.name}" deleted.`, () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setWorkspaces(snapshotWorkspaces);
      setActiveWorkspaceId(workspaceToDelete.id);
      setToast(null);
    });
  };

  const handleDeleteEnvironment = () => {
    if (environments.length <= 1) {
      showToast('error', 'Cannot delete the last environment.');
      return;
    }
    const environmentToDelete = activeEnvironment;
    const snapshotEnvironments = environments;
    const snapshotWorkspaces = workspaces;
    const fallbackEnvironment = environments.find((e) => e.id !== environmentToDelete.id);
    if (!fallbackEnvironment) return;

    setEnvironments((prev) => prev.filter((e) => e.id !== environmentToDelete.id));
    setActiveEnvironmentId((current) => current === environmentToDelete.id ? fallbackEnvironment.id : current);
    setWorkspaces((prev) => prev.map((workspace) => {
      if (!workspace.envOverrides?.[environmentToDelete.id]) return workspace;
      const nextOverrides = { ...workspace.envOverrides };
      delete nextOverrides[environmentToDelete.id];
      return { ...workspace, envOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined };
    }));

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      void deleteEnvironment(environmentToDelete.id).catch((error) => {
        setEnvironments(snapshotEnvironments);
        setWorkspaces(snapshotWorkspaces);
        setActiveEnvironmentId(environmentToDelete.id);
        showToast('error', `Failed to delete environment: ${getErrorMessage(error)}`);
      });
    }, 5000);

    showToast('success', `Environment "${environmentToDelete.name}" deleted.`, () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setEnvironments(snapshotEnvironments);
      setWorkspaces(snapshotWorkspaces);
      setActiveEnvironmentId(environmentToDelete.id);
      setToast(null);
    });
  };

  const handleHeaderSearchChange = (query: string) => {
    setHeaderSearchQuery(query);
    if (query.trim() && activeView !== 'workspace') {
      setActiveView('workspace');
    }
  };

  const handleReplay = (item: HistoryItem) => {
    if (item.workspaceId && workspaces.some(w => w.id === item.workspaceId)) {
      setActiveWorkspaceId(item.workspaceId);
    } else if (item.workspaceName) {
      const ws = workspaces.find(w => w.name === item.workspaceName);
      if (ws) setActiveWorkspaceId(ws.id);
    }

    if (item.environmentId && environments.some(e => e.id === item.environmentId)) {
      setActiveEnvironmentId(item.environmentId);
    } else if (item.environmentName) {
      const env = environments.find(e => e.name === item.environmentName);
      if (env) setActiveEnvironmentId(env.id);
    }

    setReplayItem(item);
    setActiveView('workspace');
  };

  useEffect(() => {
    // Suppress ResizeObserver loop errors which are benign but common with layout animations
    const errorHandler = (e: any) => {
      const isResizeObserverError = 
        (e?.message?.includes('ResizeObserver loop completion') || 
         e?.message?.includes('ResizeObserver loop completed') ||
         e?.reason?.message?.includes('ResizeObserver loop completion') ||
         e?.reason?.message?.includes('ResizeObserver loop completed'));

      if (isResizeObserverError) {
        const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
        const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
        if (resizeObserverErr) resizeObserverErr.style.display = 'none';
        if (resizeObserverErrDiv) resizeObserverErrDiv.style.display = 'none';
        
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (e.preventDefault) e.preventDefault();
      }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', errorHandler);
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', errorHandler);
    };
  }, []);

  const handleDeleteService = (id: string) => {
    if (!activeWorkspace) {
      return;
    }

    const service = activeWorkspace.services.find((candidate) => candidate.id === id);
    if (!service) return;
    setPendingDeleteServiceId(id);
  };

  const confirmDeleteService = () => {
    const id = pendingDeleteServiceId;
    setPendingDeleteServiceId(null);
    if (!id || !activeWorkspace) return;
    const updatedWs = {
      ...activeWorkspace,
      services: activeWorkspace.services.filter(s => s.id !== id),
    };
    handleUpdateWorkspace(updatedWs);
  };

  const handleLogHistory = (item: HistoryItem) => {
    setHistory(prev => {
      const next = [item, ...prev];
      const retention = activeWorkspace.envOverrides?.[activeEnvironmentId]?.uiConfig?.historyRetentionCount || 
                        activeWorkspace.uiConfig?.historyRetentionCount || 
                        50;
      return next.slice(0, retention);
    });

    void appendHistory(item).then(() => {
      setBootstrapError(null);
    }).catch((error) => {
      setBootstrapError(`Failed to persist history item: ${getErrorMessage(error)}`);
    });
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    void deleteHistory(id);
  };

  const handleDeleteHistoryBulk = (ids: string[]) => {
    const idSet = new Set(ids);
    setHistory(prev => prev.filter(item => !idSet.has(item.id)));
    void deleteHistoryBulk(ids);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'definitions': return <DefinitionsScreen
        workspace={activeWorkspace}
        environment={activeEnvironment}
        onUpdateWorkspace={handleUpdateWorkspace}
      />;
      case 'history': {
        const uiConfig = activeWorkspace.envOverrides?.[activeEnvironmentId]?.uiConfig ||
          activeWorkspace.uiConfig ||
          { latencyThresholds: { slow: 100, critical: 1000 } };
        return <HistoryScreen
          history={history}
          onReplay={handleReplay}
          onDelete={handleDeleteHistory}
          onDeleteBulk={handleDeleteHistoryBulk}
          activeWorkspaceId={activeWorkspaceId}
          activeEnvironmentId={activeEnvironmentId}
          latencyThresholds={uiConfig.latencyThresholds}
        />;
      }
      case 'environments': return <VariablesScreen
        environment={activeEnvironment}
        workspace={activeWorkspace}
        onUpdateEnvironment={handleUpdateEnvironment}
        onUpdateWorkspace={handleUpdateWorkspace}
        onOpenHelp={() => setIsHelpOpen(true)}
      />;
      case 'config': return <ConfigScreen
        workspace={activeWorkspace}
        environment={activeEnvironment}
        onUpdateWorkspace={handleUpdateWorkspace}
      />;
      case 'workspace': return <WorkbenchScreen
        initialRequest={replayItem}
        initialMethodId={lastMethodId}
        workspace={activeWorkspace}
        environment={activeEnvironment}
        services={activeWorkspace.services}
        globalSearchQuery={headerSearchQuery}
        onDeleteService={handleDeleteService}
        onLogHistory={handleLogHistory}
        onClearReplayItem={() => setReplayItem(null)}
        onMethodSelect={setLastMethodId}
        onNavigate={setActiveView}
        onUpdateWorkspace={handleUpdateWorkspace}
        onUpdateEnvironment={handleUpdateEnvironment}
        onShowToast={showToast}
      />;
      default: return <DefinitionsScreen
        workspace={activeWorkspace}
        environment={activeEnvironment}
        onUpdateWorkspace={handleUpdateWorkspace}
      />;
    }
  };

  return (
    <div className={`h-screen flex flex-col font-sans selection:bg-primary/30 selection:text-primary overflow-hidden w-full max-w-full ${isForcedDemoMode() ? 'forced-demo-mode' : ''}`}>
       <div ref={bgRef} className="flex-1 flex flex-col overflow-hidden min-h-0">
         <a
           href="#main-content"
           className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-2 focus:bg-surface-container-highest focus:text-on-surface focus:rounded focus:text-xs focus:font-bold focus:border focus:border-outline-variant/50 outline-none"
         >
           Skip to main content
         </a>
       <Header
         onNavigate={setActiveView}
         searchQuery={headerSearchQuery}
         onSearchQueryChange={handleHeaderSearchChange}
         isMockMode={isCurrentlyDemo || !!bootstrapError?.startsWith('Using local mock data')}
         onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
       />

       {/* Mobile Sidebar Overlay */}
       <AnimatePresence>
         {!isSidebarCollapsed && window.innerWidth < 768 && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             onClick={() => setIsSidebarCollapsed(true)}
             className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[55] md:hidden"
           />
         )}
       </AnimatePresence>

        {bootstrapError && (
          <div className={`px-4 py-2 border-b flex items-center justify-between gap-4 hide-in-demo ${bootstrapError.startsWith("Using local mock data") ? "bg-warning/5 border-warning/10" : "bg-error/5 border-error/10"}`}>
           <div className="flex items-center gap-3">
             <div className={`w-1.5 h-1.5 rounded-full ${bootstrapError.startsWith('Using local mock data') ? 'bg-warning animate-pulse' : 'bg-error'}`} />
             <span className={`text-[11px] font-mono ${bootstrapError.startsWith('Using local mock data') ? 'text-warning/70' : 'text-error/80'}`}>
               {bootstrapError}
             </span>
           </div>
            <div className="flex items-center gap-2">
              {!isCurrentlyDemo && (
                <button 
                  onClick={() => { setDemoMode(true); window.location.reload(); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Play size={10} />
                  Launch Interactive Demo
                </button>
              )}
              <button 
                onClick={() => void loadBootstrap()}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 ${
                  bootstrapError.startsWith("Using local mock data") 
                    ? "bg-warning/10 text-warning hover:bg-warning/20" 
                    : "bg-error/10 text-error hover:bg-error/20"
                }`}
              >
                <RefreshCw size={10} />
                Reconnect
              </button>
            </div>
         </div>
       )}
       {activeWorkspace.services.length === 0 && activeView !== 'definitions' && (
         <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 text-[11px] font-mono text-warning/80 flex items-center gap-3">
           <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
            <span><strong className="text-warning">{activeWorkspace.name}</strong> has no services loaded. <button onClick={() => setActiveView("definitions")} className="underline underline-offset-2 hover:text-warning transition-colors">{isForcedDemoMode() ? "Connect via reflection" : "Import a .proto or connect via reflection"}</button> to get started.</span>
         </div>
       )}

       <ContextBar
         activeWorkspace={activeWorkspace}
         activeEnvironment={activeEnvironment}
         workspaces={workspaces}
         environments={environments}
         onWorkspaceChange={setActiveWorkspaceId}
         onEnvironmentChange={setActiveEnvironmentId}
         onCreateWorkspace={() => setIsWorkspaceModalOpen(true)}
         onDeleteWorkspace={handleDeleteWorkspace}
         onCreateEnvironment={() => setIsEnvironmentModalOpen(true)}
         onDeleteEnvironment={handleDeleteEnvironment}
         canDeleteWorkspace={workspaces.length > 1}
         canDeleteEnvironment={environments.length > 1}
         onRenameWorkspace={handleRenameWorkspace}
         onRenameEnvironment={handleRenameEnvironment}
       />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            activeView={activeView}
            onNavigate={setActiveView}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            activeThemeId={effectiveThemeId}
            onThemeChange={(id) => {
              try { localStorage.setItem('grpc-theme', id); } catch { /* ignore */ }
              setActiveThemeId(id);
            }}
            onOpenHelp={() => setIsHelpOpen(true)}
          />

          <LandscapeRail activeView={activeView} onNavigate={setActiveView} />
         
          <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-background"
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
            <BottomNav activeView={activeView} onNavigate={setActiveView} />
          </main>
        </div>
       </div>

       {/* Modals */}
       <Modal
         isOpen={isWorkspaceModalOpen}
         title="Create Workspace"
         placeholder="e.g. Payments Project"
         onClose={() => setIsWorkspaceModalOpen(false)}
         onSubmit={handleCreateWorkspace}
         existingNames={workspaces.map(w => w.name)}
       />
       <Modal
        isOpen={isEnvironmentModalOpen}
        title="Create Environment"
        placeholder="e.g. Local Dev"
        onClose={() => setIsEnvironmentModalOpen(false)}
        onSubmit={handleCreateEnvironment}
        existingNames={environments.map(e => e.name)}
      />
      <ConfirmDialog
        isOpen={pendingDeleteServiceId !== null}
        title={`Remove service?`}
        message={`Remove "${activeWorkspace.services.find((s: GrpcService) => s.id === pendingDeleteServiceId)?.name ?? ''}" from "${activeWorkspace.name}"? This cannot be undone.`}
        confirmLabel="Remove Service"
        isDanger
        onConfirm={confirmDeleteService}
        onCancel={() => setPendingDeleteServiceId(null)}
      />

      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-14 right-4 z-[120] max-w-md"
          >
            <div
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
              className={`border rounded-xl shadow-2xl px-4 py-3 text-xs font-medium flex items-center gap-3 ${toast.tone === 'success' ? 'bg-success/10 border-success/40 text-success' : 'bg-error/10 border-error/40 text-error'}`}
            >
              <span className="flex-1">{toast.message}</span>
              {toast.onUndo && (
                <button
                  onClick={toast.onUndo}
                  className="shrink-0 type-btn px-2.5 py-1 rounded border border-current/30 hover:bg-current/10 transition-colors"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => setToast(null)}
                className="shrink-0 p-1 rounded text-outline hover:text-on-surface transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
