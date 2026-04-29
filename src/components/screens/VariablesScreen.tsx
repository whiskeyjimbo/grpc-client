/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, memo, useCallback, ChangeEvent, useRef, type FC } from 'react';
import {
  Trash2, Plus, Pencil, Check, X, Settings as SettingsIcon, AlertCircle, Eye, EyeOff, Tag, Layers, Globe, Braces, Hash, HelpCircle, Search, Download, Upload, ArrowLeftRight, Info, ChevronRight, Copy, ChevronDown
} from 'lucide-react';
import type { Workspace, Environment, EnvVariable } from '../../types.ts';
import { createEntityID, maskValue, isSensitiveKey } from '../../lib/utils.ts';
import { PanelHeader, EmptyState, ContextBadge, SearchInput, SegmentedControl, FilterChipGroup } from '../ui/index.ts';
import { ConfirmDialog } from '../Dialogs.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

type FlatItem = { 
  id: string; 
  key: string; 
  value: string; 
  tier: 'ENV' | 'WS' | 'OVERRIDE'; 
  overriddenBy: string | null; 
  overriddenValue?: string 
};

function TierTooltip({ tier, anchorRect }: { tier: 'ENV' | 'WS' | 'OVERRIDE', anchorRect: DOMRect }) {
  const content = {
    ENV: 'Environment baseline. Shared variables for this environment. Lowest precedence.',
    WS: 'Workspace override. Applies to all environments in this workspace. Overrides ENV.',
    OVERRIDE: 'Session override. Ephemeral variables for the current workbench state. Highest precedence.'
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 8,
        left: anchorRect.left,
        zIndex: 9999
      }}
      className="pointer-events-none"
    >
      <div className="bg-surface-container-highest border border-outline-variant/30 rounded-lg px-3 py-2 shadow-xl w-56">
        <p className="text-[12px] text-on-surface-variant/90 leading-relaxed normal-case tracking-normal font-normal">
          {content[tier]}
        </p>
      </div>
    </motion.div>,
    document.body
  );
}

function PrecedenceMapTooltip({ anchorRect }: { anchorRect: DOMRect }) {
  const portalRoot = document.body;
  if (!portalRoot) return null;

  return createPortal(
    <motion.div 
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 8,
        left: Math.min(anchorRect.left, window.innerWidth - 280),
        zIndex: 9999
      }}
      className="bg-surface-container-highest border border-outline-variant/30 rounded-xl p-4 shadow-2xl w-64 space-y-4 text-left pointer-events-none"
    >
      <div className="space-y-1">
        <h4 className="text-[12px] font-black uppercase tracking-widest text-on-surface">Precedence Ladder</h4>
        <p className="text-[11px] text-on-surface-variant/90 leading-relaxed">Values resolve from bottom to top. A higher tier masks values in lower tiers.</p>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="w-10 text-[11px] font-mono text-outline/60 uppercase text-right leading-none">High</span>
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-tertiary/10 border border-tertiary/20 text-tertiary font-bold text-[11px] shadow-sm">
             <div className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(var(--tertiary-rgb),0.4)]" />
             OVR
             <span className="text-[11px] font-normal opacity-80 ml-auto">Override</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-10" />
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-bold text-[11px] shadow-sm">
             <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]" />
             WS
             <span className="text-[11px] font-normal opacity-80 ml-auto">Workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-10 text-[11px] font-mono text-outline/60 uppercase text-right leading-none">Low</span>
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary/10 border border-secondary/20 text-secondary font-bold text-[11px] shadow-sm">
             <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(var(--secondary-rgb),0.4)]" />
             ENV
             <span className="text-[11px] font-normal opacity-80 ml-auto">Environment</span>
          </div>
        </div>
      </div>
    </motion.div>,
    portalRoot
  );
}

const VariableRow = memo(({ 
  item, 
  ts, 
  isEditing, 
  editingKey, 
  editingValue, 
  onEditStart, 
  onEditCommit, 
  onEditCancel, 
  onDelete, 
  onKeyChange, 
  onValueChange 
}: { 
  item: FlatItem; 
  ts: any; 
  isEditing: boolean; 
  editingKey: string; 
  editingValue: string; 
  onEditStart: (item: FlatItem) => void;
  onEditCommit: (item: FlatItem) => void;
  onEditCancel: () => void;
  onDelete: (item: FlatItem) => void;
  onKeyChange: (val: string) => void;
  onValueChange: (val: string) => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const tierRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(item.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item.value]);

  const handleBlur = (e: React.FocusEvent) => {
    // Only commit if the focus moved outside of the entire row
    if (rowRef.current && !rowRef.current.contains(e.relatedTarget as Node)) {
      onEditCommit(item);
    }
  };

  const handleMouseEnter = () => {
    if (tierRef.current) {
      setAnchorRect(tierRef.current.getBoundingClientRect());
      setShowTooltip(true);
    }
  };

  return (
    <motion.li 
      ref={rowRef}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ 
        duration: 0.15, 
        ease: [0.16, 1, 0.3, 1],
        layout: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
      }}
      className={`grid grid-cols-1 md:grid-cols-[5.5rem_1fr_1fr_7rem] gap-2 md:gap-4 px-5 py-2.5 md:py-2 border-b border-outline-variant/10 last:border-0 items-start md:items-center group transition-[background-color,box-shadow,transform] duration-200 ${
        isEditing 
          ? 'bg-surface-container-high/40 ring-1 ring-inset ring-primary/20 shadow-lg z-10' 
          : 'hover:bg-surface-container/40'
      } ${item.overriddenBy ? 'bg-surface-container-low/20' : ''}`}
      onBlur={isEditing ? handleBlur : undefined}
    >
      <div className="flex flex-col gap-1 shrink-0">
        <div 
          ref={tierRef}
          className="group/tier relative inline-block outline-none" 
          tabIndex={0} 
          aria-label={`Precedence: ${ts.label}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={handleMouseEnter}
          onBlur={() => setShowTooltip(false)}
        >
          <span className={`type-btn px-2 py-0.5 rounded-full cursor-default border ${ts.bg} ${ts.text} ${ts.border} ${item.overriddenBy ? 'opacity-60' : ''}`}>{ts.label}</span>
          <AnimatePresence>
            {showTooltip && anchorRect && <TierTooltip tier={item.tier} anchorRect={anchorRect} />}
          </AnimatePresence>
        </div>
        {item.overriddenBy && (
          <div className="text-[11px] font-mono flex items-center gap-1 px-1.5 py-0.5 bg-outline-variant/30 rounded-md w-fit uppercase tracking-tighter" aria-label="Overridden">
            <span className="text-on-surface-variant font-bold">overridden</span>
          </div>
        )}
      </div>

      <div className="font-mono text-xs md:text-[13px] min-w-0">
        {isEditing ? (
          <input 
            autoFocus 
            className={`w-full bg-surface-dim border ${ts.border} focus:border-primary/50 rounded px-2 py-1 text-xs font-mono outline-none transition-all shadow-inner placeholder:opacity-30`} 
            value={editingKey} 
            placeholder="KEY_NAME" 
            onChange={e => onKeyChange(e.target.value)} 
            onKeyDown={e => { if (e.key === 'Enter') onEditCommit(item); if (e.key === 'Escape') onEditCancel(); }} 
          />
        ) : (
          <span className={`text-on-surface break-all block font-medium tracking-tight ${item.overriddenBy ? 'text-on-surface-variant/60' : ''}`} aria-label={`Key: ${item.key}`}>{item.key}</span>
        )}
      </div>

      <div className="font-mono text-xs md:text-[13px] min-w-0">
        {isEditing ? (
          <div className="relative group/val">
            <input 
              className={`w-full bg-surface-dim border ${ts.border} focus:border-primary/50 rounded px-2 py-1 text-xs font-mono outline-none transition-all shadow-inner placeholder:opacity-30`} 
              type={isSensitiveKey(editingKey) ? 'password' : 'text'} 
              value={editingValue} 
              placeholder="value" 
              onChange={e => onValueChange(e.target.value)} 
              onKeyDown={e => { if (e.key === 'Enter') onEditCommit(item); if (e.key === 'Escape') onEditCancel(); }} 
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-primary/70 uppercase font-bold pointer-events-none opacity-0 group-focus-within/val:opacity-100 transition-opacity">
              Editable
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <button 
              onClick={handleCopy}
              className={`relative group/copy text-on-surface-variant break-all block text-left hover:text-primary transition-colors pr-8 ${item.overriddenBy ? 'text-outline/60 line-through decoration-outline/40' : ''}`} 
              aria-label={`Copy value: ${maskValue(item.key, item.value)}`}
            >
              <span className="relative z-10">{maskValue(item.key, item.value)}</span>
              <AnimatePresence>
                {copied ? (
                  <motion.span 
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 4 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-black text-success bg-success/10 px-2 py-0.5 rounded-sm uppercase tracking-tighter"
                  >
                    <Check size={10} />
                    COPIED
                  </motion.span>
                ) : (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/copy:opacity-40 transition-opacity">
                    <Copy size={12} />
                  </span>
                )}
              </AnimatePresence>
            </button>
            {item.overriddenBy && item.overriddenValue && (
              <span className="text-[11px] text-on-surface-variant/80 font-mono italic flex items-center gap-1.5 leading-none">
                <ArrowLeftRight size={10} className="opacity-70" />
                shadowed: {maskValue(item.key, item.overriddenValue)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 md:opacity-30 group-hover:opacity-100 focus-within:opacity-100 transition-[opacity,background-color] justify-end md:col-start-4">
        {isEditing ? (
          <>
            <button 
              onClick={() => onEditCommit(item)} 
              className="w-11 h-11 flex items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors" 
              aria-label="Save changes"
              title="Save changes (Enter)"
            >
              <Check size={14} strokeWidth={2.5} />
            </button>
            <button 
              onClick={onEditCancel} 
              className="w-11 h-11 flex items-center justify-center rounded text-outline/60 hover:text-on-surface hover:bg-surface-container-highest transition-colors" 
              aria-label="Cancel editing"
              title="Cancel (Esc)"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => onEditStart(item)} 
              className="w-11 h-11 flex items-center justify-center rounded text-outline/60 hover:text-on-surface hover:bg-surface-container-highest transition-colors" 
              aria-label={`Edit ${item.key}`}
            >
              <Pencil size={13} />
            </button>
            <button 
              onClick={() => onDelete(item)} 
              className="w-11 h-11 flex items-center justify-center rounded text-outline/40 hover:text-error hover:bg-error/10 transition-colors" 
              aria-label={`Delete ${item.key}`}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </motion.li>
  );
});

const ChipWithTooltip: FC<{ 
  chip: { id: string; label: string; activeClass: string }; 
  active: boolean; 
  onClick: () => void;
}> = ({ chip, active, onClick }) => {
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (ref.current) {
      setRect(ref.current.getBoundingClientRect());
      setShow(true);
    }
  };

  return (
    <div 
      ref={ref}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      <button
        onClick={onClick}
        aria-pressed={active}
        className={[
          'type-btn px-3 py-1 rounded-full border transition-[background-color,border-color,color,box-shadow,transform] duration-200 outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
          active
            ? `${chip.activeClass} shadow-sm`
            : 'text-outline border-outline-variant/10 bg-surface-container-low/30 hover:bg-surface-container-low hover:border-outline-variant/30 hover:text-on-surface-variant',
        ].join(' ')}
      >
        {chip.label}
      </button>
      <AnimatePresence>
        {show && rect && chip.id !== 'all' && (
          <TierTooltip tier={chip.id as any} anchorRect={rect} />
        )}
      </AnimatePresence>
    </div>
  );
};

const COMMON_HEADERS = [
  'authorization', 'grpc-timeout', 'content-type', 'user-agent',
  'grpc-encoding', 'grpc-accept-encoding', 'te', 'x-request-id'
];

const TIER_STYLES = {
  ENV:      { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/20', label: 'ENV',  borderFocus: 'focus:border-secondary' },
  WS:       { bg: 'bg-primary/10',   text: 'text-primary',   border: 'border-primary/20',   label: 'WS',   borderFocus: 'focus:border-primary'   },
  OVERRIDE: { bg: 'bg-tertiary/10',  text: 'text-tertiary',  border: 'border-tertiary/20',  label: 'OVR',  borderFocus: 'focus:border-tertiary'  },
} as const;

const TIER_CHIPS: { id: 'all' | 'ENV' | 'WS' | 'OVERRIDE'; label: string; activeClass: string }[] = [
  { id: 'all',      label: 'All', activeClass: 'bg-surface-container-highest text-on-surface border-outline-variant/50' },
  { id: 'ENV',      label: 'ENV', activeClass: 'bg-secondary/10 text-secondary border-secondary/20' },
  { id: 'WS',       label: 'WS',  activeClass: 'bg-primary/10 text-primary border-primary/20' },
  { id: 'OVERRIDE', label: 'OVR', activeClass: 'bg-tertiary/10 text-tertiary border-tertiary/20' },
];

export function VariablesScreen({
  environment,
  workspace,
  onUpdateEnvironment,
  onUpdateWorkspace,
  onOpenHelp,
  onShowToast,
}: {
  environment: Environment;
  workspace: Workspace;
  onUpdateEnvironment: (e: Environment) => void;
  onUpdateWorkspace: (w: Workspace) => void;
  onOpenHelp?: () => void;
  onShowToast?: (tone: 'success' | 'error', message: string, onUndo?: () => void) => void;
}) {
  const [itemType, setItemType] = useState<'variables' | 'headers'>('variables');
  const [tierFilter, setTierFilter] = useState<'all' | 'ENV' | 'WS' | 'OVERRIDE'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [addTier, setAddTier] = useState<'ENV' | 'WS' | 'OVERRIDE'>('ENV');
  const [addKey, setAddKey] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FlatItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addKeyInputRef = useRef<HTMLInputElement>(null);


  const { allItems, resolvedItems } = useMemo(() => {
    const isVars = itemType === 'variables';
    const envItems   = (isVars ? environment.variables : environment.headers) || [];
    const wsItems    = (isVars ? workspace.variables   : workspace.headers)   || [];
    const overItems  = (isVars ? workspace.envOverrides?.[environment.id]?.variables : workspace.envOverrides?.[environment.id]?.headers) || [];
    
    const winner = new Map<string, { tier: 'ENV' | 'WS' | 'OVERRIDE'; item: any }>();
    envItems.filter(v => v.key).forEach(v => winner.set(v.key, { tier: 'ENV', item: v }));
    wsItems.filter(v => v.key).forEach(v => winner.set(v.key, { tier: 'WS', item: v }));
    overItems.filter(v => v.key).forEach(v => winner.set(v.key, { tier: 'OVERRIDE', item: v }));
    
    const all: FlatItem[] = [];
    for (const v of envItems) {
      if (!v.key) continue;
      const win = winner.get(v.key);
      all.push({ ...v, tier: 'ENV', overriddenBy: win?.tier !== 'ENV' ? (win?.tier === 'OVERRIDE' ? 'Override' : 'Workspace') : null });
    }
    for (const v of wsItems) {
      if (!v.key) continue;
      const win = winner.get(v.key);
      all.push({ ...v, tier: 'WS', overriddenBy: win?.tier === 'OVERRIDE' ? 'Override' : null, overriddenValue: win?.tier === 'OVERRIDE' ? envItems.find(e => e.key === v.key)?.value : undefined });
    }
    for (const v of overItems) {
      if (!v.key) continue;
      const wsVal = wsItems.find(w => w.key === v.key)?.value;
      const envVal = envItems.find(e => e.key === v.key)?.value;
      all.push({ ...v, tier: 'OVERRIDE', overriddenBy: null, overriddenValue: wsVal || envVal });
    }
    
    const resolved = Array.from(winner.values()).map(({ tier, item }) => {
      const wsVal = wsItems.find(w => w.key === item.key)?.value;
      const envVal = envItems.find(e => e.key === item.key)?.value;
      return { ...item, tier, overriddenBy: null, overriddenValue: tier === 'OVERRIDE' ? (wsVal || envVal) : (tier === 'WS' ? envVal : undefined) };
    });
    
    return { allItems: all, resolvedItems: resolved };
  }, [itemType, environment, workspace]);

  const filteredItems = useMemo(() => {
    const base = tierFilter === 'all' ? resolvedItems : allItems.filter(i => i.tier === tierFilter);
    if (!searchQuery) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(i => i.key.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));
  }, [tierFilter, resolvedItems, allItems, searchQuery]);

  const handleEditStart = useCallback((item: FlatItem) => { setEditingId(item.id); setEditingKey(item.key); setEditingValue(item.value); }, []);
  const handleEditCancel = useCallback(() => setEditingId(null), []);

  const handleEditCommit = useCallback((item: FlatItem) => {
    const key = editingKey.trim(); const value = editingValue.trim();
    if (!key) { handleEditCancel(); return; }
    const updated = { id: item.id, key, value };
    const sliceKey = itemType as 'variables' | 'headers';
    const envSlice = workspace.envOverrides?.[environment.id] || { variables: [], headers: [] };
    if (item.tier === 'ENV') {
      const arr = ((itemType === 'variables' ? environment.variables : environment.headers) || []).map(v => v.id === item.id ? updated : v);
      onUpdateEnvironment({ ...environment, [sliceKey]: arr });
    } else if (item.tier === 'WS') {
      const arr = ((itemType === 'variables' ? workspace.variables : workspace.headers) || []).map(v => v.id === item.id ? updated : v);
      onUpdateWorkspace({ ...workspace, [sliceKey]: arr });
    } else {
      const arr = ((itemType === 'variables' ? envSlice.variables : envSlice.headers) || []).map(v => v.id === item.id ? updated : v);
      onUpdateWorkspace({ ...workspace, envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: { ...envSlice, [sliceKey]: arr } } });
    }
    setEditingId(null);
  }, [editingKey, editingValue, handleEditCancel, itemType, workspace, environment, onUpdateEnvironment, onUpdateWorkspace]);

  const executeDelete = useCallback((item: FlatItem) => {
    const snapEnv = { ...environment };
    const snapWS = { ...workspace };
    const sliceKey = itemType as 'variables' | 'headers';
    const envSlice = workspace.envOverrides?.[environment.id] || { variables: [], headers: [] };
    
    if (item.tier === 'ENV') {
      const arr = ((itemType === 'variables' ? environment.variables : environment.headers) || []).filter(v => v.id !== item.id);
      onUpdateEnvironment({ ...environment, [sliceKey]: arr });
    } else if (item.tier === 'WS') {
      const arr = ((itemType === 'variables' ? workspace.variables : workspace.headers) || []).filter(v => v.id !== item.id);
      onUpdateWorkspace({ ...workspace, [sliceKey]: arr });
    } else {
      const arr = ((itemType === 'variables' ? envSlice.variables : envSlice.headers) || []).filter(v => v.id !== item.id);
      onUpdateWorkspace({ ...workspace, envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: { ...envSlice, [sliceKey]: arr } } });
    }

    onShowToast?.('success', `Deleted ${item.key}`, () => {
      if (item.tier === 'ENV') onUpdateEnvironment(snapEnv);
      else onUpdateWorkspace(snapWS);
    });
  }, [itemType, workspace, environment, onUpdateEnvironment, onUpdateWorkspace, onShowToast]);

  const handleAddItem = () => {
    const key = addKey.trim(); const value = addValue.trim();
    setAddError(null);

    if (itemType === 'headers') {
      if (/[^a-zA-Z0-9-]/.test(key)) {
        setAddError('Header keys must only contain alphanumeric characters and hyphens.');
        return;
      }
      if (key !== key.toLowerCase()) {
        setAddError('gRPC headers should be lowercase by convention.');
        return;
      }
    }

    const isVars = itemType === 'variables';
    const targetList = addTier === 'ENV' 
      ? (isVars ? environment.variables : environment.headers) 
      : addTier === 'WS' 
      ? (isVars ? workspace.variables : workspace.headers)
      : (isVars ? workspace.envOverrides?.[environment.id]?.variables : workspace.envOverrides?.[environment.id]?.headers);
    
    if (targetList?.some(i => i.key === key)) {
      setAddError(`The key "${key}" already exists in the ${addTier} tier.`);
      return;
    }

    const id = createEntityID(itemType === 'variables' ? 'v' : 'h');
    const item = { id, key, value };
    const sliceKey = itemType as 'variables' | 'headers';
    const envSlice = workspace.envOverrides?.[environment.id] || { variables: [], headers: [] };
    if (addTier === 'ENV') onUpdateEnvironment({ ...environment, [sliceKey]: [...((itemType === 'variables' ? environment.variables : environment.headers) || []), item] });
    else if (addTier === 'WS') onUpdateWorkspace({ ...workspace, [sliceKey]: [...((itemType === 'variables' ? workspace.variables : workspace.headers) || []), item] });
    else onUpdateWorkspace({ ...workspace, envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: { ...envSlice, [sliceKey]: [...((itemType === 'variables' ? envSlice.variables : envSlice.headers) || []), item] } } });
    setAddKey(''); setAddValue(''); setShowSuggestions(false);
    setTimeout(() => addKeyInputRef.current?.focus(), 0);
  };

  const handleExport = () => {
    const data = tierFilter === 'all' ? resolvedItems : allItems.filter(i => i.tier === tierFilter);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grpc-${itemType}-${tierFilter}-${Date.now()}.json`;
    a.click();
    onShowToast?.('success', `Exported ${data.length} items`);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) throw new Error('Not an array');
        
        const snapEnv = { ...environment };
        const snapWS = { ...workspace };
        
        const isVars = itemType === 'variables';
        const sliceKey = itemType as 'variables' | 'headers';
        
        // Simple import into current addTier
        const newItems = json.map(i => ({ id: createEntityID(isVars ? 'v' : 'h'), key: i.key, value: i.value }));
        
        if (addTier === 'ENV') {
          onUpdateEnvironment({ ...environment, [sliceKey]: [...(environment[sliceKey] || []), ...newItems] });
        } else if (addTier === 'WS') {
          onUpdateWorkspace({ ...workspace, [sliceKey]: [...(workspace[sliceKey] || []), ...newItems] });
        } else {
          const envSlice = workspace.envOverrides?.[environment.id] || { variables: [], headers: [] };
          onUpdateWorkspace({ ...workspace, envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: { ...envSlice, [sliceKey]: [...(envSlice[sliceKey] || []), ...newItems] } } });
        }
        
        onShowToast?.('success', `Imported ${newItems.length} items`, () => {
          onUpdateEnvironment(snapEnv);
          onUpdateWorkspace(snapWS);
        });
      } catch (err) {
        onShowToast?.('error', 'Failed to parse import file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };


  const [showMap, setShowMap] = useState(false);
  const [mapAnchor, setMapAnchor] = useState<DOMRect | null>(null);
  const helpIconRef = useRef<HTMLDivElement>(null);
  const tierSelectRef = useRef<HTMLDivElement>(null);

  const handleHeaderEnter = () => {
    if (helpIconRef.current) {
      setMapAnchor(helpIconRef.current.getBoundingClientRect());
      setShowMap(true);
    }
  };

  const handleGhostEnter = () => {
    if (tierSelectRef.current) {
      setMapAnchor(tierSelectRef.current.getBoundingClientRect());
      setShowMap(true);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <AnimatePresence>
        {showMap && mapAnchor && <PrecedenceMapTooltip anchorRect={mapAnchor} />}
      </AnimatePresence>
      <PanelHeader
        icon={<Tag size={14} aria-hidden="true" />}
        title={<span className="type-display text-on-surface">Variables & Headers</span>}
        context={
          <>
            <ContextBadge role="workspace" icon={<Layers size={10} />} label={workspace.name} />
            <ContextBadge role="environment" icon={<Globe size={10} />} label={environment.name} />
          </>
        }
        actions={
          <div className="flex items-center gap-1">
            <label className="p-2 text-outline hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-primary/10" title="Import from JSON">
              <Upload size={14} />
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
            </label>
            <button 
              onClick={handleExport} 
              className="p-2 text-outline hover:text-primary transition-colors rounded-lg hover:bg-primary/10" 
              title="Export to JSON"
            >
              <Download size={14} />
            </button>
          </div>
        }
      />

      <div className="p-4 flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-6 mb-4 flex-wrap">
          <SegmentedControl
            options={[
              { id: 'variables', label: 'Variables', icon: Braces },
              { id: 'headers', label: 'Headers', icon: Hash },
            ]}
            value={itemType}
            onChange={(id) => { setItemType(id); setEditingId(null); }}
            className="w-full md:w-64"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="type-label text-outline/50 mr-1">Tier</span>
              <div className="flex items-center gap-1.5">
                {TIER_CHIPS.map((chip) => (
                  <ChipWithTooltip 
                    key={chip.id} 
                    chip={chip} 
                    active={tierFilter === chip.id} 
                    onClick={() => setTierFilter(chip.id as any)} 
                  />
                ))}
              </div>
            </div>
            {onOpenHelp && (
              <button onClick={onOpenHelp} className="p-1.5 text-outline/50 hover:text-primary transition-colors rounded-full hover:bg-primary/10" aria-label="Open tier precedence reference" title="Open tier precedence reference">
                <HelpCircle size={14} />
              </button>
            )}
          </div>

          <SearchInput 
            placeholder="Search keys or values..." 
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            className="flex-1 min-w-[240px]"
          />

          <span className="ml-auto text-[13px] text-outline/80 font-mono tabular-nums">{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}</span>
        </div>


        <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="hidden md:grid grid-cols-[5.5rem_1fr_1fr_6rem] gap-4 px-5 py-4 bg-surface-container/30 border-b border-outline-variant/20">
            <div className="flex items-center gap-2 group/header">
              <span className="type-eyebrow text-on-surface-variant/70">Source</span>
              <div 
                ref={helpIconRef}
                className="relative inline-block"
                onMouseEnter={handleHeaderEnter}
                onMouseLeave={() => setShowMap(false)}
              >
                <HelpCircle size={10} className="text-outline/30 group-hover/header:text-primary transition-colors cursor-help" />
              </div>
            </div>
            <div className="type-eyebrow text-on-surface-variant/70">Key</div>
            <div className="type-eyebrow text-on-surface-variant/70">Effective Value</div>
            <div className="type-eyebrow text-on-surface-variant/70 text-right">Actions</div>
          </div>

          <div className="flex-1">
            {/* Ghost Row Add Form - Distinctive styling to separate from data rows */}
            <div className="grid grid-cols-1 md:grid-cols-[5.5rem_1fr_1fr_6rem] gap-2 md:gap-4 px-5 py-4 border-b-2 border-outline-variant/30 bg-surface-container/60 items-center focus-within:bg-surface-container/80 transition-[background-color,border-color] duration-300 group/ghost">
              <div 
                ref={tierSelectRef}
                className="relative group/tier-select"
                onMouseEnter={handleGhostEnter}
                onMouseLeave={() => setShowMap(false)}
              >
                <select 
                  value={addTier} 
                  onChange={e => { setAddTier(e.target.value as 'ENV' | 'WS' | 'OVERRIDE'); setAddError(null); }} 
                  className="w-full bg-surface-dim border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-[11px] font-bold outline-none cursor-pointer text-on-surface-variant hover:border-primary/40 focus:border-primary/60 transition-[border-color,box-shadow] shadow-sm appearance-none"
                  aria-label="Target tier for new item"
                >
                  <option value="ENV">ENV</option>
                  <option value="WS">WS</option>
                  <option value="OVERRIDE">OVR</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                   <ChevronDown size={10} />
                </div>
              </div>
              <div className="relative">
                <input 
                  ref={addKeyInputRef}
                  className={`w-full bg-surface-dim border ${addError ? 'border-error/40 shadow-[0_0_0_2px_rgba(var(--error-rgb),0.1)]' : 'border-outline-variant/30'} rounded-lg px-3 py-2 text-[13px] font-mono focus:border-primary/60 focus:ring-2 focus:ring-primary/5 outline-none transition-[border-color,box-shadow] shadow-sm`} 
                  placeholder="new key" 
                  aria-label="New variable or header key"
                  aria-describedby={addError ? 'add-item-error' : undefined}
                  value={addKey} 
                  onChange={e => { setAddKey(e.target.value); setAddError(null); setShowSuggestions(itemType === 'headers' && !!e.target.value); }} 
                  onFocus={() => setShowSuggestions(itemType === 'headers' && !!addKey)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyDown={e => { if (e.key === 'Enter' && addKey.trim()) handleAddItem(); }} 
                />
                <AnimatePresence>
                  {showSuggestions && itemType === 'headers' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 mt-2 w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-lg z-50 py-1.5 overflow-hidden"
                    >
                      {COMMON_HEADERS.filter(h => h.includes(addKey.toLowerCase())).map(h => (
                        <button key={h} onClick={() => { setAddKey(h); setShowSuggestions(false); }} className="w-full text-left px-4 py-2 text-[12px] font-mono text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors">
                          {h}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
                <input 
                  className="w-full bg-surface-dim border border-outline-variant/30 rounded-lg px-3 py-2 text-[13px] font-mono focus:border-primary/60 focus:ring-2 focus:ring-primary/5 outline-none transition-[border-color,box-shadow] shadow-sm" 
                  placeholder="value" 
                  aria-label="New variable or header value"
                  autoComplete="off"
                  type={isSensitiveKey(addKey) ? 'password' : 'text'} 
                  value={addValue} 
                  onChange={e => setAddValue(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter' && addKey.trim()) handleAddItem(); }} 
                />
              <button 
                onClick={handleAddItem} 
                disabled={!addKey.trim()} 
                className="h-9 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 rounded-lg border border-primary/30 hover:border-primary/60 transition-[background-color,border-color,color,box-shadow,transform] disabled:opacity-30 group-focus-within/ghost:border-primary/60 active:scale-95"
              >
                <Plus size={14} aria-hidden="true" /> Add
              </button>
            </div>

            {addError && (
              <div className={`grid transition-[grid-template-rows] duration-200 ${addError ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className={`transition-opacity duration-200 ${addError ? 'opacity-100' : 'opacity-0'}`}>
                    <div id="add-item-error" role="alert" aria-live="assertive" className="mx-5 my-2 bg-error/10 border border-error/20 rounded-lg px-3 py-2 flex items-center gap-2 text-error text-[11px] font-medium">
                      <AlertCircle size={12} aria-hidden="true" />
                      {addError}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="py-20 text-center text-outline/70 text-xs italic font-medium">No {itemType} defined{tierFilter !== 'all' ? ` in ${tierFilter}` : ' yet'}.</div>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredItems.map(item => (
                    <VariableRow
                      key={`${item.tier}-${item.id}`}
                      item={item}
                      ts={TIER_STYLES[item.tier]}
                      isEditing={editingId === item.id}
                      editingKey={editingKey}
                      editingValue={editingValue}
                      onEditStart={handleEditStart}
                      onEditCommit={handleEditCommit}
                      onEditCancel={handleEditCancel}
                      onDelete={setItemToDelete}
                      onKeyChange={setEditingKey}
                      onValueChange={setEditingValue}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={itemToDelete !== null}
        title={`Delete ${itemType === 'variables' ? 'Variable' : 'Header'}?`}
        message={itemToDelete ? `Remove "${itemToDelete.key}" from the ${itemToDelete.tier} tier? This cannot be undone.` : ''}
        confirmLabel="Delete"
        isDanger
        onConfirm={() => {
          if (itemToDelete) executeDelete(itemToDelete);
          setItemToDelete(null);
        }}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
