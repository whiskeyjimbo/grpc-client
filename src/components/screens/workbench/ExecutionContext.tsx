/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Pencil, ChevronDown, ChevronUp, Server, Braces, Hash, 
  ArrowDownToLine, Check, X, Layers, Globe, Play, Lock, SaveAll, Undo2, History as HistoryIcon,
  ChevronRight
} from 'lucide-react';
import type { Workspace, Environment, EnvVariable, MetadataHeader, HistoryItem } from '../../../types.ts';
import { createEntityID, maskValue, isSensitiveKey } from '../../../lib/utils.ts';
import { ContextBadge, ChipTooltip } from '../../ui/index.ts';
import { useWorkspace } from './WorkspaceContext.tsx';

function tierBadge(tier: 'ENV' | 'WS' | 'OVERRIDE' | undefined): React.ReactNode {
  if (!tier) return <span className="w-7 shrink-0" />;
  const cls = tier === 'ENV'
    ? 'bg-secondary/10 border border-secondary/25 text-secondary/75'
    : tier === 'WS'
    ? 'bg-primary/12 border border-primary/30 text-primary/85'
    : 'bg-tertiary/35 border border-tertiary/60 text-tertiary';
  return <span className={`text-xs w-7 text-center py-px rounded font-bold shrink-0 ${cls}`}>{tier === 'OVERRIDE' ? 'OVR' : tier}</span>;
}

interface ExecutionContextProps {
  workspace: Workspace;
  environment: Environment;
  effectiveVariables: EnvVariable[];
  effectiveHeaders: MetadataHeader[];
  editingVariables: EnvVariable[];
  editingHeaders: MetadataHeader[];
  editingVariablesTier: Map<string, 'ENV' | 'WS' | 'OVERRIDE'>;
  editingHeadersTier: Map<string, 'ENV' | 'WS' | 'OVERRIDE'>;
  resolvedEndpoint: string;
  connectionPolicy: { enableTls: boolean; insecureTls?: boolean; timeoutMs: number };
  onUpdateWorkspace: (ws: Workspace) => void;
  onUpdateEnvironment: (e: Environment) => void;
  onShowToast: (tone: 'success' | 'error', message: string, onUndo?: () => void) => void;
  onExecute: (bypassWarning?: boolean) => void;
  onAbort: () => void;
  unresolvedWarning: string | null;
  setUnresolvedWarning: (w: string | null) => void;
  initialRequest: HistoryItem | null;
  onClearReplayItem: () => void;
  canExecute: boolean;
}

export function ExecutionContext({
  workspace,
  environment,
  effectiveVariables,
  effectiveHeaders,
  editingVariables,
  editingHeaders,
  editingVariablesTier,
  editingHeadersTier,
  resolvedEndpoint,
  connectionPolicy,
  onUpdateWorkspace,
  onUpdateEnvironment,
  onShowToast,
  onExecute,
  onAbort,
  unresolvedWarning,
  setUnresolvedWarning,
  initialRequest,
  onClearReplayItem,
  canExecute,
}: ExecutionContextProps) {
  const { 
    isExecuting, 
    varOverrides, 
    setVarOverrides, 
    headerOverrides, 
    setHeaderOverrides, 
    contextOpen, 
    setContextOpen 
  } = useWorkspace();

  const [hostEditing, setHostEditing] = useState(false);
  const [hostEditValue, setHostEditValue] = useState('');
  const hostEditInputRef = useRef<HTMLInputElement>(null);

  const [quickAddOpen, setQuickAddOpen] = useState<null | 'variable' | 'header'>(null);
  const [quickAddKey, setQuickAddKey] = useState('');
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddTier, setQuickAddTier] = useState<'ENV' | 'WS' | 'OVERRIDE'>('ENV');

  const [saveUndoActive, setSaveUndoActive] = useState(false);
  const [saveStripDismissed, setSaveStripDismissed] = useState(false);
  const saveUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prePromoteSnapshotRef = useRef<Workspace | null>(null);

  const [editingVarKey, setEditingVarKey] = useState<string | null>(null);
  const [editingVarValue, setEditingVarValue] = useState('');
  const [editingHeaderKey, setEditingHeaderKey] = useState<string | null>(null);
  const [editingHeaderValue, setEditingHeaderValue] = useState('');

  const clearSaveTimer = () => {
    if (saveUndoTimerRef.current) { clearTimeout(saveUndoTimerRef.current); saveUndoTimerRef.current = null; }
  };

  const [peekBarNode, setPeekBarNode] = useState<HTMLDivElement | null>(null);
  const peekBarRef = useCallback((node: HTMLDivElement | null) => setPeekBarNode(node), []);
  const [peekBarWidth, setPeekBarWidth] = useState(9999);

  useEffect(() => {
    if (!peekBarNode) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        if (w > 0) setPeekBarWidth(w);
      }
    });
    obs.observe(peekBarNode);
    return () => obs.disconnect();
  }, [peekBarNode]);

  const commitHostEdit = useCallback((raw: string) => {
    setHostEditing(false);
    const val = raw.trim();
    if (!val) return;
    const endpointKeys = ['HOST', 'GRPC_TARGET', 'ENDPOINT', 'TARGET', 'URL'];
    const existing = environment.variables?.find(v => endpointKeys.includes(v.key.trim().toUpperCase()));
    if (existing) {
      onUpdateEnvironment({
        ...environment,
        variables: environment.variables.map(v => v.id === existing.id ? { ...v, value: val } : v),
      });
    } else {
      onUpdateEnvironment({
        ...environment,
        variables: [...(environment.variables || []), { id: createEntityID('v'), key: 'HOST', value: val }],
      });
    }
  }, [environment, onUpdateEnvironment]);

  const promoteVar = (key: string, value: string) => {
    const snap = workspace;
    const existingOverrides = workspace.envOverrides?.[environment.id]?.variables || [];
    const updated = existingOverrides.some(v => v.key === key)
      ? existingOverrides.map(v => v.key === key ? { ...v, value } : v)
      : [...existingOverrides, { id: createEntityID('v'), key, value }];
    onUpdateWorkspace({
      ...workspace,
      envOverrides: {
        ...(workspace.envOverrides || {}),
        [environment.id]: {
          ...(workspace.envOverrides?.[environment.id] || { variables: [], headers: [] }),
          variables: updated,
        },
      },
    });
    onShowToast('success', `${key} promoted to OVR.`, () => onUpdateWorkspace(snap));
  };

  const promoteHeader = (key: string, value: string) => {
    const snap = workspace;
    const existingOverrides = workspace.envOverrides?.[environment.id]?.headers || [];
    const updated = existingOverrides.some(h => h.key === key)
      ? existingOverrides.map(h => h.key === key ? { ...h, value } : h)
      : [...existingOverrides, { id: createEntityID('h'), key, value }];
    onUpdateWorkspace({
      ...workspace,
      envOverrides: {
        ...(workspace.envOverrides || {}),
        [environment.id]: {
          ...(workspace.envOverrides?.[environment.id] || { variables: [], headers: [] }),
          headers: updated,
        },
      },
    });
    onShowToast('success', `${key} promoted to OVR.`, () => onUpdateWorkspace(snap));
  };

  const handleSaveToWorkspace = () => {
    prePromoteSnapshotRef.current = workspace;
    const envId = environment.id;
    const existingSlice = workspace.envOverrides?.[envId] || { variables: [], headers: [] };

    const newVars = (() => {
      if (!varOverrides || varOverrides.length === 0) return existingSlice.variables || [];
      const m = new Map((existingSlice.variables || []).map((v: EnvVariable) => [v.key, v]));
      for (const v of varOverrides) m.set(v.key, m.has(v.key) ? { ...m.get(v.key)!, value: v.value } : { id: createEntityID('v'), key: v.key, value: v.value });
      return Array.from(m.values());
    })();

    const newHeaders = (() => {
      if (!headerOverrides || headerOverrides.length === 0) return existingSlice.headers || [];
      const m = new Map((existingSlice.headers || []).map((h: MetadataHeader) => [h.key, h]));
      for (const h of headerOverrides) m.set(h.key, m.has(h.key) ? { ...m.get(h.key)!, value: h.value } : { id: createEntityID('h'), key: h.key, value: h.value });
      return Array.from(m.values());
    })();

    onUpdateWorkspace({
      ...workspace,
      envOverrides: { ...(workspace.envOverrides || {}), [envId]: { ...existingSlice, variables: newVars, headers: newHeaders } },
    });

    setSaveUndoActive(true);
    setSaveStripDismissed(false);
    clearSaveTimer();
    saveUndoTimerRef.current = setTimeout(() => {
      setSaveUndoActive(false);
      setSaveStripDismissed(true);
      setVarOverrides(null);
      setHeaderOverrides(null);
    }, 10000);
  };

  const handleUndoSave = () => {
    clearSaveTimer();
    setSaveUndoActive(false);
    if (prePromoteSnapshotRef.current) onUpdateWorkspace(prePromoteSnapshotRef.current);
  };

  const handleDismissStrip = () => {
    clearSaveTimer();
    setSaveUndoActive(false);
    setSaveStripDismissed(true);
    setVarOverrides(null);
    setHeaderOverrides(null);
  };

  const handleQuickAdd = useCallback(() => {
    const key = quickAddKey.trim(); const value = quickAddValue.trim();
    if (!key || !quickAddOpen) return;
    const id = createEntityID(quickAddOpen === 'variable' ? 'v' : 'h');
    const item = { id, key, value };
    const envSlice = workspace.envOverrides?.[environment.id] || { variables: [], headers: [] };
    if (quickAddOpen === 'variable') {
      if (quickAddTier === 'ENV') onUpdateEnvironment({ ...environment, variables: [...(environment.variables || []), item] });
      else if (quickAddTier === 'WS') onUpdateWorkspace({ ...workspace, variables: [...(workspace.variables || []), item] });
      else onUpdateWorkspace({ ...workspace, envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: { ...envSlice, variables: [...(envSlice.variables || []), item] } } });
    } else {
      if (quickAddTier === 'ENV') onUpdateEnvironment({ ...environment, headers: [...(environment.headers || []), item] });
      else if (quickAddTier === 'WS') onUpdateWorkspace({ ...workspace, headers: [...(workspace.headers || []), item] });
      else onUpdateWorkspace({ ...workspace, envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: { ...envSlice, headers: [...(envSlice.headers || []), item] } } });
    }
    setQuickAddKey(''); setQuickAddValue(''); setQuickAddOpen(null);
  }, [quickAddKey, quickAddValue, quickAddOpen, quickAddTier, workspace, environment, onUpdateEnvironment, onUpdateWorkspace]);

  const commitVarEdit = useCallback((key: string) => {
    promoteVar(key, editingVarValue);
    setEditingVarKey(null);
  }, [editingVarValue, promoteVar]);

  const commitHeaderEdit = useCallback((key: string) => {
    promoteHeader(key, editingHeaderValue);
    setEditingHeaderKey(null);
  }, [editingHeaderValue, promoteHeader]);

  return (
    <div className="shrink-0 border-t border-outline-variant/30">
      <AnimatePresence initial={false}>
        {contextOpen && (
          <motion.div
            id="context-block-body"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
            className="border-b border-outline-variant/20"
          >
               <button
                 onClick={() => setContextOpen(false)}
                 className="w-full px-4 py-1.5 flex items-center justify-between border-b border-outline-variant/10 hover:bg-surface-container-high/40 transition-colors group/collapse"
                 aria-label="Collapse context"
               >
                 <div className="flex items-center gap-2.5 min-w-0">
                   <span className="text-xs font-black uppercase tracking-[0.1em] text-on-surface-variant group-hover/collapse:text-primary transition-colors">
                     {varOverrides !== null || headerOverrides !== null ? 'Captured' : initialRequest ? 'Replaying' : 'Active'}
                   </span>
                   <div className="w-px h-2.5 bg-outline-variant/20 mx-1" />
                   <Server size={12} className="text-on-surface-variant/40 shrink-0" />
                    {hostEditing ? (
                      <input
                        ref={hostEditInputRef}
                        type="text"
                        value={hostEditValue}
                        onChange={e => setHostEditValue(e.target.value)}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') { commitHostEdit(hostEditValue); }
                          else if (e.key === 'Escape') { setHostEditing(false); }
                        }}
                        onClick={e => e.stopPropagation()}
                        onBlur={() => commitHostEdit(hostEditValue)}
                        className="flex-1 min-w-0 bg-surface-container border border-primary/40 rounded px-2 py-1 font-mono text-xs font-semibold text-on-surface tracking-tight outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        aria-label="Edit target host"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setHostEditValue(resolvedEndpoint); setHostEditing(true); setTimeout(() => hostEditInputRef.current?.focus(), 20); }}
                        className="font-mono type-label font-semibold text-on-surface tracking-tight truncate hover:text-primary focus-visible:text-primary transition-colors cursor-text text-left outline-none group/hostbtn"
                        aria-label={`Edit target host: ${resolvedEndpoint || 'no target set'}`}
                      >
                        {resolvedEndpoint || <span className="text-on-surface-variant/40 font-normal italic text-xs">no target set</span>}
                        <Pencil size={12} className="inline-block ml-2 opacity-0 group-hover/hostbtn:opacity-40 transition-opacity" />
                      </button>
                    )}
                 </div>
                 <ChevronDown size={12} className="text-outline-variant group-hover/collapse:text-primary/50 transition-colors shrink-0" aria-hidden="true" />
               </button>
               {initialRequest && (varOverrides !== null || headerOverrides !== null) && !saveUndoActive && (
                 <div className="mx-4 mt-3 px-3 py-2 bg-warning/5 border border-warning/15 rounded-lg flex items-center gap-2 min-w-0">
                   <HistoryIcon size={10} className="text-warning/40 shrink-0" />
                   <span className="text-xs font-mono text-warning truncate">
                     Loaded from history · {initialRequest.workspaceName} · {initialRequest.environmentName} · {initialRequest.timestamp}
                   </span>
                 </div>
               )}
               <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant/20">
                 <div className="p-4">
                   <h4 className="type-label text-on-surface-variant mb-3 flex items-center justify-between">
                     <span className="flex items-center gap-2 text-on-surface-variant"><Braces size={12} /> Variables</span>
                     <div className="flex items-center gap-3">
                        <div className="hidden lg:flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-container/50 border border-outline-variant/10">
                          <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mr-1">Precedence</span>
                          <span className="text-[10px] font-black text-secondary px-1.5 rounded bg-secondary/10 border border-secondary/20" title="Environment (Base)">ENV</span>
                          <ChevronRight size={10} className="text-on-surface-variant/30" />
                          <span className="text-[10px] font-black text-primary px-1.5 rounded bg-primary/10 border border-primary/20" title="Workspace (Global)">WS</span>
                          <ChevronRight size={10} className="text-on-surface-variant/30" />
                          <span className="text-[10px] font-black text-tertiary px-1.5 rounded bg-tertiary/10 border border-tertiary/20" title="Override (Specific)">OVR</span>
                        </div>
                       
                       {varOverrides && !saveUndoActive ? (
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-bold uppercase tracking-wider text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded">Captured</span>
                           <button onClick={() => setVarOverrides(null)} className="text-xs text-on-surface-variant hover:text-on-surface transition-colors" title="Discard captured variables and use live environment" aria-label="Discard captured variables">Use live</button>
                         </div>
                       ) : null}
                       {!varOverrides && (
                         <button
                           onClick={() => { setQuickAddOpen(qa => qa === 'variable' ? null : 'variable'); setQuickAddKey(''); setQuickAddValue(''); }}
                           className={`h-11 w-11 flex items-center justify-center rounded-lg transition-colors ${quickAddOpen === 'variable' ? 'text-primary bg-primary/10' : 'text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high'}`}
                           title="Quick-add variable"
                         >
                           <Plus size={14} />
                         </button>
                       )}
                     </div>
                   </h4>
                   <div className="space-y-1.5">
                     {varOverrides ? (
                       <>
                         {varOverrides.map(v => {
                           const liveVar = editingVariables.find(lv => lv.key === v.key);
                           const differs = liveVar && liveVar.value !== v.value;
                           return (
                             <div key={v.id || v.key} className="font-mono text-xs border-b border-warning/10 pb-1 last:border-0 group/capvar">
                               <div className="flex justify-between items-baseline min-w-0">
                                 <span className="text-warning/70 shrink-0 mr-2">{v.key}:</span>
                                 <div className="flex items-center gap-1 min-w-0">
                                   <span className="text-warning truncate" title={maskValue(v.key, v.value)}>{maskValue(v.key, v.value)}</span>
                                   {!saveUndoActive && (
                                     <button
                                       onClick={() => promoteVar(v.key, v.value)}
                                       className="opacity-0 group-hover/capvar:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 rounded text-warning hover:text-warning shrink-0"
                                       aria-label={`Save ${v.key} to workspace`}
                                       title={`Save ${v.key} to workspace`}
                                     >
                                       <ArrowDownToLine size={14} />
                                     </button>
                                   )}
                                 </div>
                               </div>
                               {differs && (
                                 <div className="flex justify-end mt-0.5">
                                   <span className="text-on-surface-variant/35 text-xs truncate" title={liveVar!.value}>live: {maskValue(v.key, liveVar!.value)}</span>
                                 </div>
                               )}
                             </div>
                           );
                         })}
                         {varOverrides.length === 0 && (
                           <div className="text-xs text-on-surface-variant/60 italic py-1">No variables captured</div>
                         )}
                       </>
                     ) : editingVariables.length > 0 ? (
                       editingVariables.map(v => (
                         <div key={v.id} className="flex justify-between items-center font-mono text-xs border-b border-outline-variant/15 pb-1 last:border-0 min-w-0 group/livevar">
                           <span className="text-on-surface-variant shrink-0 mr-2">
                             {v.key}:
                           </span>
                           {editingVarKey === v.key ? (
                             <input
                               autoFocus
                               className="flex-1 bg-surface-container border border-primary/50 rounded px-1 text-primary outline-none text-xs font-mono min-w-0"
                               value={editingVarValue}
                               onChange={e => setEditingVarValue(e.target.value)}
                               onBlur={() => commitVarEdit(v.key)}
                               onKeyDown={e => {
                                 if (e.key === 'Enter') { e.preventDefault(); commitVarEdit(v.key); }
                                 if (e.key === 'Escape') { e.preventDefault(); setEditingVarKey(null); }
                               }}
                             />
                           ) : (
                             <div className="flex items-center gap-1 min-w-0">
                               <span className="text-primary truncate" title={maskValue(v.key, v.value)}>
                                 {maskValue(v.key, v.value)}
                               </span>
                               <button
                                 onClick={() => { setEditingVarKey(v.key); setEditingVarValue(v.value); }}
                                 className="opacity-0 group-hover/livevar:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 rounded text-on-surface-variant/60 hover:text-primary shrink-0"
                                 aria-label={`Edit ${v.key}`}
                               >
                                 <Pencil size={12} />
                               </button>
                               {tierBadge(editingVariablesTier.get(v.key))}
                             </div>
                           )}
                         </div>
                       ))
                     ) : (
                       <button onClick={() => { setQuickAddOpen('variable'); setQuickAddKey(''); setQuickAddValue(''); }} className="text-xs text-on-surface-variant/60 italic py-1 hover:text-primary transition-colors text-left">No variables defined: add one</button>
                     )}
                   </div>
                   {quickAddOpen === 'variable' && (
                     <div className="mt-2 pt-2 border-t border-outline-variant/10 flex flex-col gap-1.5">
                       <div className="flex items-center gap-1.5">
                         <select value={quickAddTier} onChange={e => setQuickAddTier(e.target.value as 'ENV' | 'WS' | 'OVERRIDE')} className="bg-surface-container border border-outline-variant/20 rounded px-1.5 py-1 text-xs font-bold outline-none cursor-pointer text-on-surface-variant shrink-0">
                           <option value="ENV">ENV</option>
                           <option value="WS">WS</option>
                           <option value="OVERRIDE">OVR</option>
                         </select>
                         <input aria-label="Variable Key" autoFocus className="flex-1 min-w-0 bg-surface-container border border-outline-variant focus:border-primary rounded px-2 py-1.5 text-xs font-mono outline-none transition-colors" placeholder="KEY" value={quickAddKey} onChange={e => setQuickAddKey(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') setQuickAddOpen(null); }} />
                       </div>
                       <div className="flex items-center gap-1.5">
                         <div className="w-[42px] shrink-0" />
                         <input aria-label="Variable Value" className="flex-1 min-w-0 bg-surface-container border border-outline-variant focus:border-primary rounded px-2 py-1.5 text-xs font-mono outline-none transition-colors" placeholder="value" type={quickAddKey && isSensitiveKey(quickAddKey) ? 'password' : 'text'} value={quickAddValue} onChange={e => setQuickAddValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') setQuickAddOpen(null); }} />
                         <button onClick={handleQuickAdd} disabled={!quickAddKey.trim()} className="h-8 w-8 flex items-center justify-center rounded text-primary hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0" title="Add variable" aria-label="Confirm add variable"><Check size={14} /></button>
                       </div>
                     </div>
                   )}
                 </div>

                 <div className="p-4">
                   <h4 className="type-label text-on-surface-variant mb-3 flex items-center justify-between">
                     <span className="flex items-center gap-2"><Hash size={12} /> Metadata Headers</span>
                     <div className="flex items-center gap-2">
                       {headerOverrides && !saveUndoActive ? (
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-bold uppercase tracking-wider text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded">Captured</span>
                           <button onClick={() => setHeaderOverrides(null)} className="text-xs text-on-surface-variant hover:text-on-surface transition-colors" title="Discard captured headers and use live environment" aria-label="Discard captured headers">Use live</button>
                         </div>
                       ) : null}
                       {!headerOverrides && (
                         <button
                           onClick={() => { setQuickAddOpen(qa => qa === 'header' ? null : 'header'); setQuickAddKey(''); setQuickAddValue(''); }}
                           className={`h-11 w-11 flex items-center justify-center rounded-lg transition-colors ${quickAddOpen === 'header' ? 'text-secondary bg-secondary/10' : 'text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high'}`}
                           title="Quick-add header"
                         >
                           <Plus size={14} />
                         </button>
                       )}
                     </div>
                   </h4>
                   <div className="space-y-1.5">
                     <div
                       className="flex justify-between items-baseline font-mono text-xs border-b border-outline-variant/15 pb-1 min-w-0"
                       title="Added automatically by the gRPC runtime. Cannot be overridden."
                     >
                        <span className="flex items-center gap-1 shrink-0 mr-2">
                          <span className="text-on-surface-variant/60">user-agent:</span>
                          <Lock size={8} className="text-on-surface-variant/40" />
                        </span>
                        <span className="text-on-surface-variant/50 truncate">grpc-node-js/1.8.14</span>
                     </div>
                     {headerOverrides ? (
                       <>
                         {headerOverrides.map(h => {
                           const liveHeader = editingHeaders.find(lh => lh.key === h.key);
                           const differs = liveHeader && liveHeader.value !== h.value;
                           return (
                             <div key={h.id || h.key} className="font-mono text-xs border-b border-warning/10 pb-1 last:border-0 group/caphdr">
                               <div className="flex justify-between items-baseline min-w-0">
                                 <span className="text-warning/70 shrink-0 mr-2">{h.key}:</span>
                                 <div className="flex items-center gap-1 min-w-0">
                                   <span className="text-warning truncate" title={maskValue(h.key, h.value)}>{maskValue(h.key, h.value)}</span>
                                   {!saveUndoActive && (
                                     <button
                                       onClick={() => promoteHeader(h.key, h.value)}
                                       className="opacity-0 group-hover/caphdr:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 rounded text-warning hover:text-warning shrink-0"
                                       aria-label={`Save ${h.key} to workspace`}
                                       title={`Save ${h.key} to workspace`}
                                     >
                                       <ArrowDownToLine size={14} />
                                     </button>
                                   )}
                                 </div>
                               </div>
                               {differs && (
                                 <div className="flex justify-end mt-0.5">
                                   <span className="text-on-surface-variant/35 text-xs truncate" title={liveHeader!.value}>live: {maskValue(h.key, liveHeader!.value)}</span>
                                 </div>
                               )}
                             </div>
                           );
                         })}
                         {headerOverrides.length === 0 && (
                           <div className="text-xs text-on-surface-variant/60 italic py-1">No headers captured</div>
                         )}
                       </>
                     ) : effectiveHeaders.length > 0 ? (
                       effectiveHeaders.map(h => (
                         <div key={h.id} className="flex justify-between items-center font-mono text-xs border-b border-outline-variant/15 pb-1 last:border-0 min-w-0 group/livehdr">
                           <span className="text-on-surface-variant shrink-0 mr-2">
                             {h.key}:
                           </span>
                           {editingHeaderKey === h.key ? (
                             <input
                               autoFocus
                               className="flex-1 bg-surface-container border border-primary/50 rounded px-1 text-secondary outline-none text-xs font-mono min-w-0"
                               value={editingHeaderValue}
                               onChange={e => setEditingHeaderValue(e.target.value)}
                               onBlur={() => commitHeaderEdit(h.key)}
                               onKeyDown={e => {
                                 if (e.key === 'Enter') { e.preventDefault(); commitHeaderEdit(h.key); }
                                 if (e.key === 'Escape') { e.preventDefault(); setEditingHeaderKey(null); }
                               }}
                             />
                           ) : (
                             <div className="flex items-center gap-1 min-w-0">
                               <span className="text-secondary truncate" title={maskValue(h.key, h.value)}>
                                 {maskValue(h.key, h.value)}
                               </span>
                               <button
                                 onClick={() => { setEditingHeaderKey(h.key); setEditingHeaderValue(h.value); }}
                                 className="opacity-0 group-hover/livehdr:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 rounded text-on-surface-variant/60 hover:text-secondary shrink-0"
                                 aria-label={`Edit ${h.key}`}
                               >
                                 <Pencil size={12} />
                               </button>
                               {tierBadge(editingHeadersTier.get(h.key))}
                             </div>
                           )}
                         </div>
                       ))
                     ) : (
                       <button onClick={() => { setQuickAddOpen('header'); setQuickAddKey(''); setQuickAddValue(''); }} className="text-xs text-on-surface-variant/60 italic py-1 hover:text-secondary transition-colors text-left">No custom headers: add one</button>
                     )}
                   </div>
                   {quickAddOpen === 'header' && (
                     <div className="mt-2 pt-2 border-t border-outline-variant/10 flex flex-col gap-1.5">
                       <div className="flex items-center gap-1.5">
                         <select value={quickAddTier} onChange={e => setQuickAddTier(e.target.value as 'ENV' | 'WS' | 'OVERRIDE')} className="bg-surface-container border border-outline-variant/20 rounded px-1.5 py-1 text-xs font-bold outline-none cursor-pointer text-on-surface-variant shrink-0">
                           <option value="ENV">ENV</option>
                           <option value="WS">WS</option>
                           <option value="OVERRIDE">OVR</option>
                         </select>
                         <input aria-label="Header Key" autoFocus className="flex-1 min-w-0 bg-surface-container border border-outline-variant focus:border-secondary rounded px-2 py-1.5 text-xs font-mono outline-none transition-colors" placeholder="KEY" value={quickAddKey} onChange={e => setQuickAddKey(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') setQuickAddOpen(null); }} />
                       </div>
                       <div className="flex items-center gap-1.5">
                         <div className="w-[42px] shrink-0" />
                         <input aria-label="Header Value" className="flex-1 min-w-0 bg-surface-container border border-outline-variant focus:border-secondary rounded px-2 py-1.5 text-xs font-mono outline-none transition-colors" placeholder="value" type={quickAddKey && isSensitiveKey(quickAddKey) ? 'password' : 'text'} value={quickAddValue} onChange={e => setQuickAddValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') setQuickAddOpen(null); }} />
                         <button onClick={handleQuickAdd} disabled={!quickAddKey.trim()} className="h-8 w-8 flex items-center justify-center rounded text-secondary hover:bg-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0" title="Add header" aria-label="Confirm add header"><Check size={14} /></button>
                       </div>
                     </div>
                   )}
                 </div>
               </div>
               {!saveStripDismissed && ((varOverrides !== null && varOverrides.length > 0) || (headerOverrides !== null && headerOverrides.length > 0)) && (
                 <div className="px-4 py-2.5 border-t border-warning/10 overflow-hidden">
                   <AnimatePresence mode="wait" initial={false}>
                     {saveUndoActive ? (
                       <motion.div
                         key="undo"
                         initial={{ opacity: 0, y: -4 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: 4 }}
                         transition={{ duration: 0.15 }}
                         className="flex items-center justify-between gap-2"
                       >
                         <span className="flex items-center gap-1.5 text-xs text-on-surface-variant/40 font-mono">
                           <Check size={9} className="text-success/50" />
                           Saved to workspace
                         </span>
                         <div className="flex items-center gap-1.5">
                           <button
                             onClick={handleUndoSave}
                             className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface-variant border border-outline-variant/20 hover:border-outline-variant/50 rounded px-2.5 py-1 transition-colors"
                           >
                             <Undo2 size={9} />
                             Undo
                           </button>
                           <button
                             onClick={handleDismissStrip}
                             className="p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors"
                             aria-label="Dismiss"
                           >
                             <X size={10} />
                           </button>
                         </div>
                       </motion.div>
                     ) : (
                       <motion.div
                         key="save"
                         initial={{ opacity: 0, y: 4 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: -4 }}
                         transition={{ duration: 0.15 }}
                         className="flex items-center justify-between gap-2"
                       >
                         <span className="text-xs text-warning font-mono">Captured from history</span>
                         <div className="flex items-center gap-1.5">
                           <button
                             onClick={handleSaveToWorkspace}
                             className="flex items-center gap-1.5 text-xs text-warning/70 hover:text-warning border border-warning/20 hover:border-warning/40 rounded px-3 py-1 transition-colors"
                           >
                             <SaveAll size={10} />
                             Save captured to workspace
                           </button>
                           <button
                             onClick={handleDismissStrip}
                             className="p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors"
                             aria-label="Dismiss"
                           >
                             <X size={10} />
                           </button>
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
               )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {!contextOpen && (
          <motion.div
            key="peek"
            ref={peekBarRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
            className="w-full px-4 pt-2 pb-1.5 flex flex-col gap-1 border-b border-outline-variant/10 group/peek"
          >
                <button 
                  type="button"
                  onClick={() => setContextOpen(true)}
                  className="flex items-center justify-between gap-2 mb-0.5 hover:bg-surface-container-high/50 px-2 -mx-2 rounded transition-colors group/expand"
                  aria-label="Expand context"
                >
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-on-surface-variant group-hover/expand:text-primary transition-colors">
                     {varOverrides !== null || headerOverrides !== null ? 'Captured' : initialRequest ? 'Replaying' : 'Active'}
                   </span>
                  <ChevronUp size={12} className="text-on-surface-variant/40 group-hover/expand:text-primary/50 transition-colors" aria-hidden="true" />
                </button>

                <div className="flex items-center gap-1.5 px-2 -mx-2" onClick={e => e.stopPropagation()}>
                 <Server size={12} className="text-on-surface-variant/40 shrink-0" />
                 {hostEditing ? (
                   <input
                     ref={hostEditInputRef}
                     type="text"
                     value={hostEditValue}
                     onChange={e => setHostEditValue(e.target.value)}
                     onKeyDown={e => {
                       if (e.key === 'Enter') { commitHostEdit(hostEditValue); }
                       else if (e.key === 'Escape') { setHostEditing(false); }
                     }}
                     onBlur={() => commitHostEdit(hostEditValue)}
                     className="flex-1 min-w-0 bg-surface-container border border-primary/40 rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-on-surface tracking-tight outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                     aria-label="Edit target host"
                   />
                 ) : (
                    <button
                      type="button"
                      onClick={() => { setHostEditValue(resolvedEndpoint); setHostEditing(true); setTimeout(() => hostEditInputRef.current?.focus(), 20); }}
                      className="font-mono type-label font-semibold text-on-surface tracking-tight truncate hover:text-primary transition-colors cursor-text text-left group/peekhost"
                      aria-label={`Edit target host: ${resolvedEndpoint || 'no target set'}`}
                    >
                      {resolvedEndpoint || <span className="text-on-surface-variant/40 font-normal italic text-xs">no target set</span>}
                      <Pencil size={12} className="inline-block ml-1.5 opacity-0 group-hover/peekhost:opacity-40 transition-opacity" />
                    </button>
                 )}
               </div>
               {(() => {
                 const maxVisible = Math.min(8, Math.max(2, Math.floor((peekBarWidth - 81) / 68)));
                 const peekChipCls = (tier: string | undefined, overrideActive: boolean, defaultCls: string) =>
                   overrideActive ? 'bg-warning/5 border-warning/20 text-warning/60'
                   : tier === 'ENV'      ? 'bg-secondary/10 border-secondary/25 text-secondary/80'
                   : tier === 'WS'       ? 'bg-primary/12 border-primary/30 text-primary/85'
                   : tier === 'OVERRIDE' ? 'bg-tertiary/30 border-tertiary/55 text-tertiary font-bold'
                   : defaultCls;
                 return (<>
               <div className="flex items-center gap-1.5 flex-wrap">
                 <Braces size={12} className="text-on-surface-variant/40 shrink-0" />
                 {effectiveVariables.length === 0 ? (
                   <span className="font-mono text-xs text-on-surface-variant/40 italic">none</span>
                 ) : (
                   <>
                     {effectiveVariables.slice(0, maxVisible).map(v => {
                       const tier = !varOverrides ? editingVariablesTier.get(v.key) : undefined;
                       return (
                         <ChipTooltip
                           key={v.id}
                           label={v.key}
                           content={v.value ? `${v.key} = ${v.value}` : ''}
                           chipCls={`font-mono text-xs px-1.5 py-px rounded border whitespace-nowrap cursor-default ${peekChipCls(tier, !!varOverrides, 'bg-primary/5 border-primary/15 text-on-surface-variant/70')}`}
                         />
                       );
                     })}
                     {effectiveVariables.length > maxVisible && (
                       <span className="font-mono text-xs text-on-surface-variant/40">+{effectiveVariables.length - maxVisible}</span>
                     )}
                   </>
                 )}
               </div>
               <div className="flex items-center gap-1.5 flex-wrap">
                 <Hash size={12} className="text-on-surface-variant/40 shrink-0" />
                 {effectiveHeaders.length === 0 ? (
                   <span className="font-mono text-xs text-on-surface-variant/40 italic">none</span>
                 ) : (
                   <>
                     {effectiveHeaders.slice(0, maxVisible).map(h => {
                       const tier = !headerOverrides ? editingHeadersTier.get(h.key) : undefined;
                       return (
                         <ChipTooltip
                           key={h.id}
                           label={h.key}
                           content={h.value ? `${h.key}: ${h.value}` : ''}
                           chipCls={`font-mono text-xs px-1.5 py-px rounded border whitespace-nowrap cursor-default ${peekChipCls(tier, !!headerOverrides, 'bg-secondary/5 border-secondary/15 text-on-surface-variant/70')}`}
                         />
                       );
                     })}
                     {effectiveHeaders.length > maxVisible && (
                       <span className="font-mono text-xs text-outline-variant">+{effectiveHeaders.length - maxVisible}</span>
                     )}
                   </>
                 )}
               </div>
               </>);
               })()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-2 md:py-2.5 landscape:py-1.5 bg-surface-container grid grid-cols-2 gap-3 items-center relative">
        <AnimatePresence>
          {unresolvedWarning && !isExecuting && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute bottom-[110%] right-4 z-50 max-w-sm bg-warning-container text-on-warning-container text-xs p-4 rounded-lg shadow-2xl border border-warning/30 flex flex-col gap-3"
            >
              <p className="leading-relaxed"><strong>Unresolved variables detected.</strong><br/>{unresolvedWarning}</p>
              <div className="flex items-center justify-end gap-2 mt-1">
                <button onClick={() => setUnresolvedWarning(null)} className="px-3 py-1.5 hover:bg-surface-container-highest rounded font-medium transition-colors">Cancel</button>
                <button onClick={() => { setUnresolvedWarning(null); onExecute(true); }} className="px-3 py-1.5 bg-warning text-warning-container font-bold rounded shadow-sm hover:opacity-90 active:scale-95 transition-all">Send Anyway</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-3 min-w-0">
          {(() => {
            const hasOverrides = varOverrides !== null || headerOverrides !== null;
            return (
              <div className="flex items-center gap-2 px-1 py-0.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasOverrides ? 'bg-warning animate-pulse' : initialRequest ? 'bg-warning/35' : 'bg-success'}`} />
              </div>
            );
          })()}
          {connectionPolicy.enableTls && (
            <span className="type-label text-secondary flex items-center gap-1 shrink-0" title={connectionPolicy.insecureTls ? 'TLS enabled, cert not verified' : 'TLS enabled'}>
              <Lock size={10} className={connectionPolicy.insecureTls ? 'text-warning' : 'text-secondary'} />
              {connectionPolicy.insecureTls ? 'TLS (insecure)' : 'TLS'}
            </span>
          )}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <ContextBadge role="workspace" icon={<Layers size={10} />} label={workspace.name} />
            <ContextBadge role="environment" icon={<Globe size={10} />} label={environment.name} />
          </div>
        </div>
        <div className="flex items-center">
          {isExecuting ? (
            <button
              onClick={onAbort}
              className="w-full flex items-center justify-center gap-2 px-5 py-2 bg-error/10 text-error border border-error/20 type-btn rounded-lg hover:bg-error/20 active:scale-95 transition"
            >
              <X size={14} />
              Cancel
            </button>
          ) : (
            <button
              onClick={() => { onExecute(); }}
              disabled={!canExecute}
              className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-primary text-on-primary type-btn rounded-lg hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={!canExecute ? (initialRequest ? 'Select a method first' : 'Add a HOST, GRPC_TARGET, or ENDPOINT variable to define the target server') : undefined}
            >
              <Play size={14} fill="currentColor" />
              Execute
              <kbd className="text-xs opacity-55 font-mono normal-case tracking-normal">⌘↵</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
