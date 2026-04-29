/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, Fragment, useRef, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History as HistoryIcon, Trash2, Search, Play, Check, X,
  MoreVertical, Calendar, ArrowUpDown, ChevronDown, ChevronRight, Tag, Box, Network, Layers, Globe, RefreshCw, Braces, Hash
} from 'lucide-react';
import type { HistoryItem } from '../../types.ts';
import { getLatencyColor, GRPC_STATUS_DESCRIPTIONS, maskValue, formatRelativeTime } from '../../lib/utils.ts';
import { PanelHeader, CodeBlock, MonoKeyValue, EmptyState, FilterChipGroup, ContextBadge, SearchInput, JsonValue } from '../ui/index.ts';
import { ConfirmDialog } from '../Dialogs.tsx';


function LatencyDisplay({ latency, thresholds }: { latency: string, thresholds?: { slow: number; critical: number } }) {
  const ms = parseInt(latency, 10);
  if (isNaN(ms)) return <span className="text-on-surface-variant/80">{latency}</span>;
  const cls = getLatencyColor(ms, thresholds);
  const isCritical = ms >= (thresholds?.critical ?? 1000);
  const isSlow = ms >= (thresholds?.slow ?? 100);
  const marker = isCritical ? ' !' : isSlow ? ' ~' : '';
  const statusLabel = isCritical ? 'Critical Latency' : isSlow ? 'Slow Latency' : 'Good Latency';

  return (
    <span className={cls} aria-label={`${latency}. ${statusLabel}`}>
      {latency}{marker}
    </span>
  );
}

type HistoryStatusFilter = 'ALL' | 'OK' | 'INTERNAL' | 'OTHER';
type HistoryDateFilter = 'ALL' | '1h' | '24h' | '7d';

const HistoryRow = memo(({ 
  item, 
  index,
  isExpanded, 
  isFocused,
  activeWorkspaceId,
  activeEnvironmentId,
  latencyThresholds,
  onToggle,
  onReplay,
  onDelete,
  onFocus
}: { 
  item: HistoryItem, 
  index: number,
  isExpanded: boolean, 
  isFocused: boolean,
  activeWorkspaceId: string,
  activeEnvironmentId: string,
  latencyThresholds?: { slow: number; critical: number },
  onToggle: (id: string) => void,
  onReplay: (item: HistoryItem) => void,
  onDelete: (id: string) => void,
  onFocus: (index: number) => void,
}) => {
  const rowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.focus();
    }
  }, [isFocused]);

  return (
    <tr
      className={`hover:bg-surface-container-high/50 transition-[background-color] duration-200 group ${isExpanded ? 'bg-surface-container-high/30' : ''} ${isFocused ? 'bg-surface-container-high/20 ring-1 ring-inset ring-primary/40' : ''}`}
    >
      <td className="pl-3 pr-1 py-3 w-12">
        <button
          ref={rowRef}
          onClick={() => onToggle(item.id)}
          onFocus={() => onFocus(index)}
          aria-expanded={isExpanded}
          aria-controls={`expanded-content-${item.id}`}
          aria-label={`${item.method}. ${isExpanded ? 'Collapse' : 'Expand'} details.`}
          className={`w-11 h-11 flex items-center justify-center rounded transition-[background-color,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low ${isExpanded ? 'text-primary bg-primary/5' : 'text-on-surface-variant/70 hover:text-primary hover:bg-surface-container-high'}`}
        >
           {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
      </td>
      <td className="px-4 py-5 font-mono text-[11px] text-on-surface-variant/70 whitespace-nowrap tabular-nums tracking-tight">
        <span className="cursor-default" aria-label={`Timestamp: ${new Date(item.timestamp).toLocaleString()}`}>
          {formatRelativeTime(item.timestamp)}
        </span>
      </td>
      <td className="hidden lg:table-cell px-4 py-5">
         <ContextBadge
           role={item.workspaceId === activeWorkspaceId ? 'workspace' : 'neutral'}
           icon={<Layers size={10} aria-hidden="true" />}
           label={item.workspaceName}
         />
      </td>
      <td className="hidden xl:table-cell px-4 py-5">
         <ContextBadge
           role={item.environmentId === activeEnvironmentId ? 'environment' : 'neutral'}
           icon={<Globe size={10} aria-hidden="true" />}
           label={item.environmentName}
         />
      </td>
      <td className="px-4 py-5 font-mono text-[13px] text-primary font-bold tracking-tight truncate max-w-[200px]" aria-label={`Method: ${item.method}`}>{item.method}</td>
      <td className="hidden md:table-cell px-4 py-5 font-mono text-[12px] text-on-surface-variant/80 tracking-tight truncate max-w-[240px]" aria-label={`Endpoint: ${item.endpoint}`}>{item.endpoint}</td>
      <td className="px-4 py-5">
        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
          item.status === 'OK'
            ? 'bg-success/10 text-success border-success/20'
            : item.status === 'INTERNAL'
              ? 'bg-error/10 text-error border-error/20'
              : 'bg-outline/10 text-outline border-outline/20'
        }`}>
          {item.status}
        </span>
      </td>
      <td className="px-4 py-5 text-right font-mono text-[13px] tabular-nums font-medium">
        <LatencyDisplay latency={item.latency} thresholds={latencyThresholds} />
      </td>
      <td className="px-3 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onReplay(item); }}
            className="w-11 h-11 flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10 rounded transition-[background-color,color] duration-200"
            title="Replay Request"
            aria-label="Replay request"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="w-11 h-11 flex items-center justify-center text-outline/60 hover:text-error hover:bg-error/10 rounded transition-[opacity,background-color,color] duration-200 lg:opacity-30 group-hover:opacity-100 focus-visible:opacity-100"
            title="Delete"
            aria-label={`Delete history entry for ${item.method}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export function HistoryScreen({ 
  history, 
  onReplay, 
  onDelete, 
  onDeleteBulk, 
  activeWorkspaceId, 
  activeEnvironmentId,
  latencyThresholds
}: { 
  history: HistoryItem[], 
  onReplay: (item: HistoryItem) => void, 
  onDelete: (id: string) => void, 
  onDeleteBulk: (ids: string[]) => void, 
  activeWorkspaceId: string, 
  activeEnvironmentId: string,
  latencyThresholds?: { slow: number; critical: number }
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [requestCollapsed, setRequestCollapsed] = useState(false);
  const [responseCollapsed, setResponseCollapsed] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>('ALL');
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const dateMs: Record<HistoryDateFilter, number> = { ALL: 0, '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 };
    const cutoff = dateFilter === 'ALL' ? 0 : now - dateMs[dateFilter];

    return history.filter(item => {
      if (dateFilter !== 'ALL' && new Date(item.timestamp).getTime() < cutoff) return false;
      if (statusFilter === 'OK' && item.status !== 'OK') return false;
      if (statusFilter === 'INTERNAL' && item.status !== 'INTERNAL') return false;
      if (statusFilter === 'OTHER' && (item.status === 'OK' || item.status === 'INTERNAL')) return false;
      if (filter) {
        const q = filter.toLowerCase();
        if (!item.method.toLowerCase().includes(q) && !item.workspaceName.toLowerCase().includes(q) && !item.environmentName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [history, filter, statusFilter, dateFilter]);

  useEffect(() => {
    setRequestCollapsed(false);
    setResponseCollapsed(false);
  }, [expandedId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, filteredHistory.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredHistory.length) {
        e.preventDefault();
        const item = filteredHistory[focusedIndex];
        setExpandedId(prev => prev === item.id ? null : item.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredHistory, focusedIndex]);

  useEffect(() => {
    if (focusedIndex >= filteredHistory.length) {
      setFocusedIndex(Math.max(-1, filteredHistory.length - 1));
    }
  }, [filteredHistory.length, focusedIndex]);

  const handleClearFiltered = () => {
    setClearHistoryDialogOpen(true);
  };

  const confirmClearFiltered = () => {
    setClearHistoryDialogOpen(false);
    onDeleteBulk(filteredHistory.map(item => item.id));
  };

  const STATUS_CHIPS: { id: HistoryStatusFilter; label: string; activeClass?: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'OK', label: 'OK', activeClass: 'bg-success/15 text-success border-success/30' },
    { id: 'INTERNAL', label: 'Internal', activeClass: 'bg-error/15 text-error border-error/30' },
    { id: 'OTHER', label: 'Other', activeClass: 'bg-warning/15 text-warning border-warning/30' },
  ];

  const DATE_CHIPS: { id: HistoryDateFilter; label: string; activeClass?: string }[] = [
    { id: 'ALL', label: 'Any time' },
    { id: '1h', label: '1h' },
    { id: '24h', label: '24h' },
    { id: '7d', label: '7d' },
  ];

  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <>
    <div className="flex flex-col min-h-full">
      <PanelHeader
        icon={<HistoryIcon size={14} aria-hidden="true" />}
        title={<span className="type-display text-on-surface">Request History</span>}
      />

      <div className="p-4 flex flex-col flex-1 overflow-y-auto custom-scrollbar">
      {/* Filter bar */}
      <div className="bg-surface-container-low/50 border border-outline-variant/20 rounded-lg p-2 mb-6 flex flex-wrap items-center gap-4 shrink-0">
        <div className="flex items-center gap-4 px-2">
          <FilterChipGroup
            label="Status"
            chips={STATUS_CHIPS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <div className="w-px h-4 bg-outline-variant/20" />
          <FilterChipGroup
            label="When"
            chips={DATE_CHIPS}
            value={dateFilter}
            onChange={setDateFilter}
          />
        </div>

        <div className="flex-1 min-w-[240px]">
          <SearchInput
            placeholder="Filter history by method or context..."
            value={filter}
            onChange={setFilter}
            onClear={() => setFilter('')}
            ariaLabel="Filter history"
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-4 ml-auto pr-2">
          <span aria-live="polite" aria-atomic="true" className="text-[10px] text-outline/60 font-mono uppercase tracking-widest font-bold tabular-nums">
            {filteredHistory.length} MATCH{filteredHistory.length !== 1 ? 'ES' : ''}
          </span>
          <div className="w-px h-4 bg-outline-variant/20" />
          {filteredHistory.length > 0 && (
            <button
              onClick={handleClearFiltered}
              className="flex items-center gap-2 text-error/70 hover:text-error transition-colors px-3 py-1.5 rounded-md hover:bg-error/10"
              title="Delete all visible results"
            >
              <Trash2 size={12} aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Clear results</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-surface-container-lowest/30 border border-outline-variant/15 rounded-md overflow-hidden flex flex-col [scrollbar-gutter:stable]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-full table-fixed" aria-label="Call history">
             <thead>
                 <tr className="bg-surface-container/40 border-b border-outline-variant/20">
                  <th scope="col" aria-label="Expand" className="w-12 px-2 py-4"></th>
                  <th scope="col" className="w-28 sm:w-44 px-4 py-4 type-eyebrow text-outline/60 text-left">Timestamp</th>
                  <th scope="col" className="hidden lg:table-cell w-56 px-4 py-4 type-eyebrow text-outline/60 text-left">Workspace</th>
                  <th scope="col" className="hidden xl:table-cell w-40 px-4 py-4 type-eyebrow text-outline/60 text-left">Environment</th>
                  <th scope="col" className="w-40 sm:w-56 px-4 py-4 type-eyebrow text-outline/60 text-left">Method</th>
                  <th scope="col" className="hidden md:table-cell w-auto px-4 py-4 type-eyebrow text-outline/60 text-left">Endpoint</th>
                  <th scope="col" className="w-20 sm:w-28 px-4 py-4 type-eyebrow text-outline/60 text-left">Status</th>
                  <th scope="col" className="w-20 sm:w-28 px-4 py-4 type-eyebrow text-outline/60 text-right">Latency</th>
                  <th scope="col" aria-label="Row actions" className="w-28 px-4 py-4 text-right"></th>
                </tr>
             </thead>
             <tbody className="divide-y divide-outline-variant/10">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center" role="alert" aria-live="polite">
                      <p className="text-outline italic text-xs mb-2">No matching history found.</p>
                      {(statusFilter !== 'ALL' || dateFilter !== 'ALL' || filter) && (
                        <button
                          onClick={() => { setFilter(''); setStatusFilter('ALL'); setDateFilter('ALL'); }}
                          className="text-[11px] text-primary/70 hover:text-primary transition-colors"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, index) => (
                    <Fragment key={item.id}>
                      <HistoryRow 
                        item={item}
                        index={index}
                        isExpanded={expandedId === item.id}
                        isFocused={focusedIndex === index}
                        activeWorkspaceId={activeWorkspaceId}
                        activeEnvironmentId={activeEnvironmentId}
                        latencyThresholds={latencyThresholds}
                        onToggle={handleToggle}
                        onReplay={onReplay}
                        onDelete={onDelete}
                        onFocus={setFocusedIndex}
                      />
                      <AnimatePresence initial={false}>
                      {expandedId === item.id && (
                        <tr
                          key={`expanded-${item.id}`}
                          id={`expanded-content-${item.id}`}
                          className="bg-surface-container-lowest/30"
                        >
                          <td colSpan={9} className="p-0 border-none overflow-hidden">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <div className="px-12 py-8">
                                <div className="flex flex-col gap-8">
                                   {/* Variables + Request Headers + Response Trailers side-by-side */}
                                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-6 pb-8 border-b border-outline-variant/10">
                                     <div>
                                       <h4 className="mb-4 text-on-surface-variant/50 uppercase tracking-[0.15em] text-[10px] font-black">
                                         Variables
                                       </h4>
                                       {!item.resolvedVariables || item.resolvedVariables.length === 0 ? (
                                         <div className="text-[12px] text-outline/50 italic py-1">No variables captured.</div>
                                       ) : (
                                         <div className="space-y-1.5">
                                           {item.resolvedVariables.map(v => (
                                             <MonoKeyValue key={v.id} label={v.key} value={maskValue(v.key, v.value)} valueColorClass="text-primary/90" />
                                           ))}
                                         </div>
                                       )}
                                     </div>
                                     <div>
                                       <h4 className="mb-4 text-on-surface-variant/50 uppercase tracking-[0.15em] text-[10px] font-black">
                                         Request Headers
                                       </h4>
                                       {!item.requestHeaders || item.requestHeaders.length === 0 ? (
                                         <div className="text-[12px] text-outline/50 italic py-1">No custom headers sent.</div>
                                       ) : (
                                         <div className="space-y-1.5">
                                           {item.requestHeaders.map(h => (
                                             <MonoKeyValue key={h.id} label={h.key} value={maskValue(h.key, h.value)} valueColorClass="text-secondary/90" />
                                           ))}
                                         </div>
                                       )}
                                     </div>
                                     <div>
                                       <h4 className="mb-4 text-on-surface-variant/50 uppercase tracking-[0.15em] text-[10px] font-black">
                                         Response Trailers
                                       </h4>
                                       {!item.responseHeaders || Object.keys(item.responseHeaders).length === 0 ? (
                                         <div className="text-[12px] text-outline/50 italic py-1">No trailers received.</div>
                                       ) : (
                                         <div className="space-y-1.5">
                                           {Object.entries(item.responseHeaders as Record<string, string>).map(([k, v]) => (
                                             <MonoKeyValue key={k} label={k} value={v} valueColorClass="text-tertiary/90" />
                                           ))}
                                         </div>
                                       )}
                                     </div>
                                   </div>

                                   {/* Payloads (Two Columns) */}
                                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                     <div className="flex flex-col">
                                        <button
                                          onClick={() => setRequestCollapsed(c => !c)}
                                          aria-expanded={!requestCollapsed}
                                          className="mb-4 flex items-center gap-2 hover:text-on-surface transition-colors w-full text-left uppercase tracking-[0.15em] text-[10px] font-black text-on-surface-variant/50 group/btn"
                                        >
                                          <motion.span animate={{ rotate: requestCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                                            <ChevronDown size={12} className="text-primary/60 group-hover/btn:text-primary transition-colors" />
                                          </motion.span>
                                          Request Payload
                                        </button>
                                         <div className={`grid transition-[grid-template-rows] duration-200 ${!requestCollapsed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                           <div className="overflow-hidden">
                                             <div className={`transition-opacity duration-200 ${!requestCollapsed ? 'opacity-100' : 'opacity-0'}`}>
                                               <CodeBlock minHeight="160px">
                                                 <JsonValue value={item.requestPayload} />
                                               </CodeBlock>
                                             </div>
                                           </div>
                                         </div>
                                     </div>
                                     <div className="flex flex-col">
                                        <button
                                          onClick={() => setResponseCollapsed(c => !c)}
                                          aria-expanded={!responseCollapsed}
                                          className="type-label text-on-surface-variant/70 mb-4 flex items-center gap-2.5 hover:text-on-surface transition-colors w-full text-left uppercase tracking-widest text-[10px] font-bold group/btn"
                                        >
                                          <motion.span animate={{ rotate: responseCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                                            <ChevronDown size={14} className="text-secondary group-hover/btn:scale-110 transition-transform" />
                                          </motion.span>
                                          Response Payload
                                        </button>
                                         <div className={`grid transition-[grid-template-rows] duration-200 ${!responseCollapsed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                           <div className="overflow-hidden">
                                             <div className={`transition-opacity duration-200 ${!responseCollapsed ? 'opacity-100' : 'opacity-0'}`}>
                                               <CodeBlock minHeight="160px">
                                                 <JsonValue value={item.responsePayload} />
                                               </CodeBlock>
                                             </div>
                                           </div>
                                         </div>
                                     </div>
                                   </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                      </AnimatePresence>
                    </Fragment>
                  ))
                )}
             </tbody>
          </table>
        </div>
        <div className="mt-auto px-4 py-2.5 bg-surface-container-low/30 border-t border-outline-variant/10 flex justify-between items-center">
          <span className="text-[10px] text-outline/60 font-mono uppercase tracking-widest font-bold">
            {filteredHistory.length} of {history.length} request{history.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      </div>
    </div>
    <ConfirmDialog
      isOpen={clearHistoryDialogOpen}
      title="Delete history?"
      message={`Delete ${filteredHistory.length} history item${filteredHistory.length !== 1 ? 's' : ''}? This cannot be undone.`}
      confirmLabel="Delete"
      isDanger
      onConfirm={confirmClearFiltered}
      onCancel={() => setClearHistoryDialogOpen(false)}
    />
    </>
  );
}
