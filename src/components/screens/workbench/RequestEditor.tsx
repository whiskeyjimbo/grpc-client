/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, Server, HelpCircle, BookOpen 
} from 'lucide-react';
import type { Workspace, Environment, GrpcMethod, EnvVariable, GrpcService } from '../../../types.ts';
import { createEntityID } from '../../../lib/utils.ts';
import { PanelHeader, DynamicField } from '../../ui/index.ts';
import { useWorkspace, useRequestData } from './WorkspaceContext.tsx';

interface RequestEditorProps {
  workspace: Workspace;
  environment: Environment;
  services: GrpcService[];
  effectiveVariables: EnvVariable[];
  endpointQuickTarget: string;
  setEndpointQuickTarget: (v: string) => void;
  onUpdateEnvironment: (e: Environment) => void;
  hasEndpoint: boolean;
  selectedServiceName?: string;
}

export function RequestEditor({
  workspace,
  environment,
  services,
  effectiveVariables,
  endpointQuickTarget,
  setEndpointQuickTarget,
  onUpdateEnvironment,
  hasEndpoint,
  selectedServiceName,
}: RequestEditorProps) {
  const { selectedMethod, isExecuting } = useWorkspace();
  const { requestData, updateRequestData } = useRequestData();

  return (
    <div className="flex-1 min-w-0 md:min-w-[280px] flex flex-col overflow-hidden">
      <PanelHeader
        icon={<Layers size={14} aria-hidden="true" />}
        title={<span className="type-display text-on-surface">Workbench</span>}
        context={
          selectedMethod && (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 font-mono h-full pt-1">
                <span className="type-label text-on-surface-variant/70 uppercase tracking-tight leading-none hidden xs:inline">
                  {selectedServiceName} /
                </span>
                <span className="type-label font-bold text-on-surface tracking-tight leading-none truncate max-w-[120px] xs:max-w-none">
                  {selectedMethod.name}
                </span>
              </div>
              <span className="text-xs font-black px-2 py-1 rounded-sm uppercase tracking-wider bg-surface-container-highest text-on-surface-variant border border-outline-variant/30 flex items-center gap-1.5">
                {selectedMethod.type !== 'unary' && (
                  <motion.span
                    className="w-2 h-2 rounded-full bg-primary shrink-0"
                    animate={isExecuting ? { opacity: [1, 0.4, 1] } : { opacity: 0.6 }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {selectedMethod.type.replace('_', ' ')}
              </span>
            </div>
          )
        }
        actions={
          workspace.services.length === 0 && !isExecuting && (
            <div className="flex items-center gap-1.5 type-label text-outline/60" title="Load service definitions on the Definitions tab">
              <div className="w-1.5 h-1.5 rounded-full bg-outline-variant shrink-0" />
              No definitions
            </div>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Endpoint not configured: inline nudge */}
        <AnimatePresence initial={false}>
          {!hasEndpoint && selectedMethod && (
            <motion.div
              key="no-endpoint"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg border border-outline-variant/20 bg-surface-container p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <Server size={13} className="text-outline/50 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface mb-0.5">No target server set</p>
                  <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                    This workspace reads the host from a variable named <span className="font-mono bg-surface-container-highest px-1 rounded text-on-surface">HOST</span>, <span className="font-mono bg-surface-container-highest px-1 rounded text-on-surface">GRPC_TARGET</span>, or <span className="font-mono bg-surface-container-highest px-1 rounded text-on-surface">ENDPOINT</span>. Add one below to enable execution.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="localhost:50051"
                  value={endpointQuickTarget}
                  onChange={e => setEndpointQuickTarget(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && endpointQuickTarget.trim()) {
                      onUpdateEnvironment({ ...environment, variables: [...(environment.variables || []), { id: createEntityID('v'), key: 'HOST', value: endpointQuickTarget.trim() }] });
                      setEndpointQuickTarget('');
                    }
                  }}
                  className="flex-1 bg-surface-dim border border-outline-variant/30 rounded-lg px-3 py-1.5 text-xs font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-[border-color,box-shadow] duration-200"
                  aria-label="Quick-set HOST variable"
                />
                <button
                  onClick={() => {
                    if (!endpointQuickTarget.trim()) return;
                    onUpdateEnvironment({ ...environment, variables: [...(environment.variables || []), { id: createEntityID('v'), key: 'HOST', value: endpointQuickTarget.trim() }] });
                    setEndpointQuickTarget('');
                  }}
                  disabled={!endpointQuickTarget.trim()}
                  className="px-4 py-2 text-xs font-bold bg-primary text-on-primary rounded-lg hover:opacity-90 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Set HOST
                </button>
              </div>
              <p className="text-xs text-on-surface-variant/60 font-mono">Saved to the current environment. Manage all variables in the Variables tab.</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="space-y-4">
          {selectedMethod?.requestFields && selectedMethod.requestFields.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">Fields</span>
              <div className="group/legend relative flex items-center">
                <button
                  type="button"
                  id="variable-help-button"
                  aria-label="Help with variables"
                  aria-haspopup="true"
                  aria-controls="variable-help-tooltip"
                  className="text-outline-variant hover:text-outline/70 focus-visible:text-outline transition-colors outline-none rounded-sm ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low"
                >
                  <HelpCircle size={11} />
                </button>
                <div 
                  id="variable-help-tooltip"
                  role="tooltip"
                  className="absolute top-full left-0 mt-2 pointer-events-none opacity-0 group-hover/legend:opacity-100 group-focus-within/legend:opacity-100 transition-opacity duration-150 z-50"
                >
                  <div className="bg-surface-container-highest border border-outline-variant/30 rounded-lg p-3 shadow-xl w-64 space-y-3">
                    <p className="text-[12px] text-on-surface-variant leading-relaxed">
                      Use <span className="font-mono bg-surface-container px-1 rounded text-primary">{'{{VAR_NAME}}'}</span> in any field to interpolate a variable.
                    </p>
                    <div className="border-t border-outline-variant/10 pt-3 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px] font-bold bg-success/15 rounded px-1.5 py-0.5 text-success uppercase tracking-wider shrink-0">resolved</span>
                        <span className="text-[11px] text-on-surface-variant/80">Found in active environment</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px] font-bold bg-error/15 rounded px-1.5 py-0.5 text-error uppercase tracking-wider shrink-0">missing</span>
                        <span className="text-[11px] text-on-surface-variant/80">Sent as raw text placeholder</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-6">
            {selectedMethod?.requestFields ? (
              selectedMethod.requestFields.map(f => (
                <Fragment key={f.name}>
                  <DynamicField
                    field={f}
                    path={f.name}
                    variables={effectiveVariables}
                    requestData={requestData}
                    onValueChange={updateRequestData}
                  />
                </Fragment>
              ))
            ) : (
              <div className="py-20 text-center border border-dashed border-outline-variant/20 rounded-xl bg-surface-container-low/30">
                <div className="w-12 h-12 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-5 border border-outline-variant/10 opacity-60">
                  <BookOpen size={20} className="text-on-surface-variant" />
                </div>
                <h4 className="text-on-surface font-semibold text-sm mb-1.5">No Schema Defined</h4>
                <p className="text-on-surface-variant/60 text-xs max-w-[220px] mx-auto italic font-mono leading-relaxed">
                  This method accepts an empty message or does not declare fields.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
