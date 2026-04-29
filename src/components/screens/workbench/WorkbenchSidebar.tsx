/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Server, Network, CloudUpload, Trash2, Info } from 'lucide-react';
import type { GrpcService, GrpcMethod, HistoryItem, ViewType } from '../../../types.ts';
import { PanelHeader } from '../../ui/index.ts';

interface WorkspaceSidebarProps {
  services: GrpcService[];
  globalSearchQuery: string;
  expandedServices: string[];
  isFilteringServices: boolean;
  toggleService: (id: string) => void;
  onDeleteService: (id: string) => void;
  selectedMethod: GrpcMethod | null;
  setSelectedMethod: (m: GrpcMethod | null) => void;
  onMethodSelect?: (id: string) => void;
  initialRequest: HistoryItem | null;
  onClearReplayItem: () => void;
  isExecuting: boolean;
  onNavigate?: (v: ViewType) => void;
  filteredServices: GrpcService[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const WorkbenchSidebar = memo(function WorkbenchSidebar({
  services,
  globalSearchQuery,
  expandedServices,
  isFilteringServices,
  toggleService,
  onDeleteService,
  selectedMethod,
  setSelectedMethod,
  onMethodSelect,
  initialRequest,
  onClearReplayItem,
  isExecuting,
  onNavigate,
  filteredServices,
  isCollapsed = false,
  onToggleCollapse
}: WorkspaceSidebarProps) {
  const methodRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleMethodKeyNav = (e: React.KeyboardEvent<HTMLButtonElement>, methodId: string) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const visibleMethods = filteredServices.flatMap(s => 
      (expandedServices.includes(s.id) || isFilteringServices) ? s.methods.map(m => m.id) : []
    );
    const idx = visibleMethods.indexOf(methodId);
    if (idx === -1) return;
    const nextId = e.key === 'ArrowDown' ? visibleMethods[idx + 1] : visibleMethods[idx - 1];
    if (nextId) {
      const nextBtn = methodRefs.current.get(nextId);
      if (nextBtn) { nextBtn.focus(); nextBtn.click(); }
    }
  };

  return (

      <aside 
        aria-label="Service Explorer" 
        className={`shrink-0 border-outline-variant/30 bg-background flex flex-col transition-all duration-300 ease-out-expo ${
          isCollapsed 
            ? 'w-full md:w-12 h-11 md:h-full border-b md:border-b-0 md:border-r overflow-hidden' 
            : 'w-full md:w-72 h-[40vh] md:h-auto border-b md:border-b-0 md:border-r'
        }`}
      >
        <PanelHeader
          title={
            <div className="flex items-center gap-2 overflow-hidden">
               <button 
                onClick={onToggleCollapse}
                className="p-1 -ml-1 rounded hover:bg-surface-container transition-colors text-outline-variant hover:text-on-surface"
                title={isCollapsed ? "Expand Methods" : "Collapse Methods"}
              >
                <ChevronRight size={14} className={`transition-transform duration-300 ${isCollapsed ? '' : 'rotate-90'}`} />
              </button>
              <span className="type-display text-on-surface truncate">Methods</span>
            </div>
          }
          actions={
            !isCollapsed && isFilteringServices ? (
              <span className="type-eyebrow text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none">
                {filteredServices.reduce((n, s) => n + s.methods.length, 0)} match{filteredServices.reduce((n, s) => n + s.methods.length, 0) !== 1 ? 'es' : ''}
              </span>
            ) : undefined
          }
        />
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          {filteredServices.length === 0 ? (
            <div className="p-8 text-center space-y-5">
              {isFilteringServices ? (
                <p className="type-label text-outline leading-relaxed pt-2">No methods match &ldquo;{globalSearchQuery}&rdquo;</p>
              ) : (
                <>
                  <div className="flex items-end justify-center gap-1.5 h-8">
                    {[0.55, 1, 0.35].map((scale, i) => (
                      <motion.span
                        key={i}
                        className="block w-1 h-6 rounded-full bg-outline/30"
                        style={{ transformOrigin: 'bottom' }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: scale }}
                        transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                      />
                    ))}
                  </div>
                  <p className="type-label text-outline tracking-widest uppercase">No Signal Detected</p>
                  <p className="text-[11px] text-on-surface-variant -mt-1 leading-relaxed">
                    Import service definitions to start exploring and testing your gRPC API.
                  </p>
                  <div className="pt-2 space-y-1">
                    <button
                      onClick={() => onNavigate?.('definitions')}
                      className="w-full text-[11px] font-semibold text-primary/80 hover:text-primary py-2 px-2.5 rounded bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-all text-left flex items-start gap-2.5 group"
                    >
                      <Server size={12} className="shrink-0 mt-0.5 text-primary/60 group-hover:text-primary" aria-hidden="true" />
                      <span>
                        <span className="block mb-0.5">Reflect from live server</span>
                        <span className="block text-[10px] font-normal text-outline/60 leading-normal">Query a running gRPC server with reflection enabled.</span>
                      </span>
                    </button>
                    <button
                      onClick={() => onNavigate?.('definitions')}
                      className="w-full text-[11px] font-medium text-outline hover:text-on-surface py-2 px-2.5 rounded hover:bg-surface-container transition-all text-left flex items-start gap-2.5"
                    >
                      <CloudUpload size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <span className="block mb-0.5">Import .proto file</span>
                        <span className="block text-[10px] font-normal text-outline/40 leading-normal">Work offline by parsing a local schema file.</span>
                      </span>
                    </button>
                  </div>
                  <div className="pt-4 flex items-center justify-center gap-1.5 opacity-40">
                    <Info size={10} className="text-outline" aria-hidden="true" />
                    <span className="text-[10px] font-mono uppercase tracking-tighter text-outline">v1.4.2 stable</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            filteredServices.map(service => (
              <div key={service.id} className="mb-1">
                <div className="flex items-center group/service">
                  <button
                    onClick={() => toggleService(service.id)}
                    aria-expanded={expandedServices.includes(service.id) || isFilteringServices}
                    aria-label={`${expandedServices.includes(service.id) || isFilteringServices ? 'Collapse' : 'Expand'} ${service.name}`}
                    className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-surface-container transition-colors text-on-surface-variant text-left min-w-0"
                  >
                    <div className={`transition-transform duration-200 shrink-0 ${expandedServices.includes(service.id) || isFilteringServices ? 'rotate-90' : ''}`}>
                      <ChevronRight size={14} aria-hidden="true" />
                    </div>
                    <Network size={14} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
                    <span className="font-mono text-xs truncate" title={service.name}>{service.name}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteService(service.id);
                    }}
                    className="px-3 py-2 text-outline/60 opacity-0 group-hover/service:opacity-100 group-focus-within/service:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset hover:text-error transition shrink-0 outline-none rounded"
                    aria-label={`Remove ${service.name} service`}
                    title="Remove service"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
                
                <AnimatePresence initial={false}>
                  {(expandedServices.includes(service.id) || isFilteringServices) && (
                    <motion.div
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden origin-top"
                    >
                      {service.methods.map(method => (
                        <button
                           key={method.id}
                           ref={(el) => {
                             if (el) methodRefs.current.set(method.id, el);
                             else methodRefs.current.delete(method.id);
                           }}
                           data-method-btn={method.id}
                           onClick={() => {
                             if (initialRequest) {
                               onClearReplayItem();
                             }
                             setSelectedMethod(method);
                             onMethodSelect?.(method.id);
                           }}
                           onKeyDown={(e) => handleMethodKeyNav(e, method.id)}
                           className={`w-full flex items-center gap-3 pl-10 pr-3 py-2.5 transition-all relative outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                             selectedMethod?.id === method.id
                               ? 'text-on-surface bg-surface-container-high'
                               : 'text-on-surface-variant hover:bg-surface-container'
                           }`}
                        >
                           {selectedMethod?.id === method.id && (
                             <ChevronRight size={10} strokeWidth={3} className="absolute left-2 top-1/2 -translate-y-1/2 text-primary shrink-0" aria-hidden="true" />
                           )}
                           <div className={`w-1.5 h-1.5 rounded-full ${selectedMethod?.id === method.id ? 'bg-primary' : 'bg-outline-variant/50'}`} aria-hidden="true" />
                           <span className="font-mono text-[11px] truncate" title={method.name}>{method.name}</span>
                          {method.type !== 'unary' && (
                            method.type === 'server_streaming' ? (
                              <motion.span
                                className="ml-auto text-[11px] font-bold uppercase px-1 rounded border border-outline/30 text-outline/60"
                                animate={selectedMethod?.id === method.id && isExecuting ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                              >
                                Server Stream
                              </motion.span>
                            ) : (
                              <span className="ml-auto text-[11px] font-bold uppercase px-1 rounded border border-outline/30 text-outline/60">
                                {method.type === 'client_streaming' ? 'Client Stream' : 'Bidirectional'}
                              </span>
                            )
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </aside>
  );
});
