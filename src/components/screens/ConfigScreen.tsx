import { useMemo, useState, useCallback } from 'react';
import {
  Layers, Globe, Shield, Clock, AlertCircle, Trash2, Plus, Lock, Settings as SettingsIcon, ChevronRight,
  Palette, Zap, Activity, Info
} from 'lucide-react';
import type { Workspace, Environment, ConnectionPolicy, UIConfig } from '../../types.ts';
import { PanelHeader, SectionCard, Toggle, ContextBadge, ChipTooltip, DebouncedNumericInput } from '../ui/index.ts';

export function ConfigScreen({
  workspace,
  environment,
  onUpdateWorkspace,
}: {
  workspace: Workspace;
  environment: Environment;
  onUpdateWorkspace: (ws: Workspace) => void;
}) {
  const defaultPolicy = useMemo((): ConnectionPolicy => 
    workspace.connectionPolicy || { enableTls: false, timeoutMs: 5000, maxReceiveSizeMb: 4 },
    [workspace.connectionPolicy]
  );
  
  const envOverridePolicy = useMemo(() => 
    workspace.envOverrides?.[environment.id]?.connectionPolicy,
    [workspace.envOverrides, environment.id]
  );

  const defaultUI = useMemo((): UIConfig => 
    workspace.uiConfig || { latencyThresholds: { slow: 100, critical: 1000 }, historyRetentionCount: 50 },
    [workspace.uiConfig]
  );
  
  const envOverrideUI = useMemo(() => 
    workspace.envOverrides?.[environment.id]?.uiConfig,
    [workspace.envOverrides, environment.id]
  );

  const updateWorkspacePolicy = useCallback((policy: ConnectionPolicy) => {
    onUpdateWorkspace({ ...workspace, connectionPolicy: policy });
  }, [workspace, onUpdateWorkspace]);

  const updateEnvOverridePolicy = useCallback((policy: ConnectionPolicy) => {
    const existing = workspace.envOverrides?.[environment.id] || { variables: [], headers: [] };
    onUpdateWorkspace({
      ...workspace,
      envOverrides: {
        ...(workspace.envOverrides || {}),
        [environment.id]: { ...existing, connectionPolicy: policy },
      },
    });
  }, [workspace, environment.id, onUpdateWorkspace]);

  const clearEnvOverridePolicy = () => {
    const overrides = workspace.envOverrides?.[environment.id];
    if (!overrides) return;
    const { connectionPolicy: _removed, ...rest } = overrides;
    onUpdateWorkspace({
      ...workspace,
      envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: rest },
    });
  };

  const updateWorkspaceUI = useCallback((ui: UIConfig) => {
    onUpdateWorkspace({ ...workspace, uiConfig: ui });
  }, [workspace, onUpdateWorkspace]);

  const updateEnvOverrideUI = useCallback((ui: UIConfig) => {
    const existing = workspace.envOverrides?.[environment.id] || { variables: [], headers: [] };
    onUpdateWorkspace({
      ...workspace,
      envOverrides: {
        ...(workspace.envOverrides || {}),
        [environment.id]: { ...existing, uiConfig: ui },
      },
    });
  }, [workspace, environment.id, onUpdateWorkspace]);

  const clearEnvOverrideUI = () => {
    const overrides = workspace.envOverrides?.[environment.id];
    if (!overrides) return;
    const { uiConfig: _removed, ...rest } = overrides;
    onUpdateWorkspace({
      ...workspace,
      envOverrides: { ...(workspace.envOverrides || {}), [environment.id]: rest },
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <PanelHeader
        icon={<SettingsIcon size={14} aria-hidden="true" />}
        title={<span className="type-display text-on-surface">Configuration</span>}
        context={
          <>
            <ContextBadge role="workspace" icon={<Layers size={10} aria-hidden="true" />} label={workspace.name} />
            <ContextBadge role="environment" icon={<Globe size={10} aria-hidden="true" />} label={environment.name} />
          </>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-12 md:space-y-16">
        <div className="max-w-5xl space-y-12 md:space-y-16">
          {/* Precedence Map Section */}
          <div className="space-y-5">
            <div className="flex items-center justify-between max-w-2xl px-1">
              <h2 className="type-eyebrow text-on-surface-variant/90">Precedence Map</h2>
              <span className="text-[11px] font-mono text-on-surface-variant/50">Resolving cascade (Left to Right)</span>
            </div>
            
            <div 
              className="flex items-center gap-6 text-[12px] font-mono text-on-surface-variant bg-surface-container-low/60 border border-outline-variant/20 rounded-2xl px-6 py-4 w-fit shadow-sm relative overflow-hidden group"
              role="region" 
              aria-label="Tier Precedence Map"
            >
              <div className="absolute inset-0 bg-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="flex items-center gap-4 relative z-10">
                {/* System ENV - Disabled but shown for context */}
                <div 
                  className="flex flex-col items-center gap-1.5 opacity-20 grayscale cursor-help" 
                  aria-label="System Tier (Lower precedence, currently read-only)"
                >
                  <ChipTooltip 
                    label="ENV" 
                    content="System baseline: controlled by environment variables and CLI flags." 
                    chipCls="px-3 py-1 rounded-lg bg-surface-container border border-outline/10 text-outline font-bold text-[12px] block"
                  />
                  <span className="text-[9px] uppercase tracking-tighter font-black opacity-60">System</span>
                </div>
                
                <ChevronRight size={14} className="text-outline/30" aria-hidden="true" />
                
                {/* Workspace Default - Active if no override */}
                <div 
                  className={`flex flex-col items-center gap-1.5 transition-[transform,opacity] duration-500 ${(!envOverridePolicy && !envOverrideUI) ? 'scale-110' : 'opacity-40'}`}
                  aria-label="Workspace Tier (Default precedence)"
                  aria-current={(!envOverridePolicy && !envOverrideUI) ? "true" : "false"}
                >
                  <span className={`px-3 py-1 rounded-lg border font-bold text-[12px] shadow-sm transition-[background-color,border-color,color,box-shadow] duration-500 ${(!envOverridePolicy && !envOverrideUI) ? 'bg-primary/20 border-primary/40 text-primary ring-2 ring-primary/10' : 'bg-surface-container border-outline/10 text-outline'}`}>
                    WS
                  </span>
                  <span className="text-[9px] uppercase tracking-tighter font-black">Workspace</span>
                </div>
                
                <ChevronRight size={14} className={`transition-colors ${(!envOverridePolicy && !envOverrideUI) ? 'text-outline/20' : 'text-primary/40'}`} aria-hidden="true" />
                
                {/* Override Tier - Active if override exists */}
                <div 
                  className={`flex flex-col items-center gap-1.5 transition-[transform,opacity] duration-500 ${(envOverridePolicy || envOverrideUI) ? 'scale-110' : 'opacity-40'}`}
                  aria-label="Override Tier (Highest precedence)"
                  aria-current={(envOverridePolicy || envOverrideUI) ? "true" : "false"}
                >
                  <span className={`px-3 py-1 rounded-lg border font-bold text-[12px] shadow-sm transition-[background-color,border-color,color,box-shadow] duration-500 ${(envOverridePolicy || envOverrideUI) ? 'bg-tertiary/20 border-tertiary/40 text-tertiary ring-2 ring-tertiary/10' : 'bg-surface-container border-outline/10 text-outline'}`}>
                    OVR
                  </span>
                  <span className="text-[9px] uppercase tracking-tighter font-black">Override</span>
                </div>
              </div>
              
              <div className="h-6 w-px bg-outline-variant/20 mx-2" />
              
              <div className="flex flex-col gap-0.5" aria-live="polite">
                <span className="text-[10px] uppercase tracking-[0.1em] font-black text-outline/60">Currently Active</span>
                <span className={`text-[12px] font-bold transition-colors duration-500 ${(envOverridePolicy || envOverrideUI) ? 'text-tertiary' : 'text-primary'}`}>
                  {(envOverridePolicy || envOverrideUI) ? `Override (${environment.name})` : 'Workspace Default'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection Policy Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2.5 px-1">
              <Zap size={16} className="text-primary" aria-hidden="true" />
              <h2 className="type-eyebrow text-on-surface-variant/90">Network Policy</h2>
            </div>
            
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl overflow-hidden shadow-sm">
              <div className="w-full">
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-[1fr_180px_180px] border-b border-outline-variant/30 bg-surface-container/30 px-6 py-4 items-center">
                  <span className="type-eyebrow text-on-surface-variant/60">Policy Setting</span>
                  <span className="type-eyebrow text-on-surface-variant/60 text-center">Workspace Default</span>
                  <span className="type-eyebrow text-secondary/80 text-center font-bold">Environment Override</span>
                </div>
              
                <div className="divide-y divide-outline-variant/15">
                  {/* TLS Toggle Row */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] px-6 py-5 items-start md:items-center hover:bg-surface-container/20 transition-colors group gap-4 md:gap-0">
                    <div className="space-y-1">
                      <p className="text-[13px] font-bold text-on-surface">Transport Security (TLS)</p>
                      <p className="text-[12px] text-on-surface-variant/80">Encrypt traffic to the gRPC backend</p>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-center border-t md:border-t-0 md:border-r border-outline-variant/10 pt-4 md:pt-0 h-full">
                      <span className="md:hidden type-eyebrow text-on-surface-variant/60">Workspace Default</span>
                      <Toggle
                        checked={defaultPolicy.enableTls}
                        onChange={(v) => updateWorkspacePolicy({ ...defaultPolicy, enableTls: v })}
                        aria-label="Enable TLS for workspace defaults"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-center px-0 md:px-4">
                      <span className="md:hidden type-eyebrow text-secondary/80 font-bold">Environment Override</span>
                      {envOverridePolicy ? (
                        <Toggle
                          checked={envOverridePolicy.enableTls}
                          onChange={(v) => updateEnvOverridePolicy({ ...envOverridePolicy, enableTls: v })}
                          activeColor="bg-secondary"
                          aria-label="Enable TLS for environment override"
                        />
                      ) : (
                        <button 
                          onClick={() => updateEnvOverridePolicy({ ...defaultPolicy })}
                          className="text-[11px] font-bold uppercase tracking-widest text-outline/50 hover:text-secondary hover:bg-secondary/10 px-4 py-2 rounded-lg transition-all border border-transparent hover:border-secondary/20"
                          aria-label="Add environment override for TLS"
                        >
                          Override
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Insecure Mode Row */}
                  <div className={`grid grid-cols-1 md:grid-cols-[1fr_180px_180px] px-6 py-5 items-start md:items-center hover:bg-surface-container/20 transition-colors group gap-4 md:gap-0 ${(!defaultPolicy.enableTls && (!envOverridePolicy || !envOverridePolicy.enableTls)) ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                    <div className="space-y-1">
                      <p className="text-[13px] font-bold text-on-surface">Skip Verification</p>
                      <p className="text-[12px] text-on-surface-variant/80">Trust self-signed or invalid certificates</p>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-center border-t md:border-t-0 md:border-r border-outline-variant/10 pt-4 md:pt-0 h-full">
                      <span className="md:hidden type-eyebrow text-on-surface-variant/60">Workspace Default</span>
                      <Toggle
                        checked={!!defaultPolicy.insecureTls}
                        onChange={(v) => updateWorkspacePolicy({ ...defaultPolicy, insecureTls: v })}
                        disabled={!defaultPolicy.enableTls}
                        activeColor="bg-warning"
                        aria-label="Skip certificate verification for workspace defaults"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-center px-0 md:px-4">
                      <span className="md:hidden type-eyebrow text-secondary/80 font-bold">Environment Override</span>
                      {envOverridePolicy ? (
                        <Toggle
                          checked={!!envOverridePolicy.insecureTls}
                          onChange={(v) => updateEnvOverridePolicy({ ...envOverridePolicy, insecureTls: v })}
                          disabled={!envOverridePolicy.enableTls}
                          activeColor="bg-warning"
                          aria-label="Skip certificate verification for environment override"
                        />
                      ) : (
                        <button 
                          onClick={() => updateEnvOverridePolicy({ ...defaultPolicy })}
                          className="text-[11px] font-bold uppercase tracking-widest text-outline/50 hover:text-secondary hover:bg-secondary/10 px-4 py-2 rounded-lg transition-all border border-transparent hover:border-secondary/20"
                          aria-label="Add environment override for certificate verification"
                        >
                          Override
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Request Timeout Row */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] px-6 py-6 items-start md:items-center hover:bg-surface-container/20 transition-colors group gap-4 md:gap-0">
                    <div className="space-y-1">
                      <p className="text-[13px] font-bold text-on-surface">Request Timeout</p>
                      <p className="text-[12px] text-on-surface-variant/80">Maximum duration for a single gRPC call</p>
                    </div>
                    
                    <div className="flex flex-col md:items-center border-t md:border-t-0 md:border-r border-outline-variant/10 pt-4 md:pt-0 h-full px-0 md:px-4 gap-2 md:gap-0">
                      <span className="md:hidden type-eyebrow text-on-surface-variant/60">Workspace Default</span>
                      <DebouncedNumericInput
                        label="WS Timeout"
                        unit="ms"
                        min={100}
                        value={defaultPolicy.timeoutMs}
                        onChange={(v) => updateWorkspacePolicy({ ...defaultPolicy, timeoutMs: v })}
                        className="w-full md:max-w-[140px]"
                      />
                    </div>
                    
                    <div className="flex flex-col md:items-center px-0 md:px-4 gap-2 md:gap-0">
                      <span className="md:hidden type-eyebrow text-secondary/80 font-bold">Environment Override</span>
                      {envOverridePolicy ? (
                        <DebouncedNumericInput
                          label="Env Timeout"
                          unit="ms"
                          min={100}
                          theme="secondary"
                          value={envOverridePolicy.timeoutMs}
                          onChange={(v) => updateEnvOverridePolicy({ ...envOverridePolicy, timeoutMs: v })}
                          className="w-full md:max-w-[140px]"
                        />
                      ) : (
                        <button 
                          onClick={() => updateEnvOverridePolicy({ ...defaultPolicy })}
                          className="text-[11px] font-bold uppercase tracking-widest text-outline/50 hover:text-secondary hover:bg-secondary/10 px-4 py-2 rounded-lg transition-all border border-transparent hover:border-secondary/20"
                          aria-label="Add environment override for request timeout"
                        >
                          Override
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Max Receive Size Row */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] px-6 py-6 items-start md:items-center hover:bg-surface-container/20 transition-colors group gap-4 md:gap-0">
                    <div className="space-y-1">
                      <p className="text-[13px] font-bold text-on-surface">Max Response Size</p>
                      <p className="text-[12px] text-on-surface-variant/80">Limit for incoming message payloads</p>
                    </div>
                    
                    <div className="flex flex-col md:items-center border-t md:border-t-0 md:border-r border-outline-variant/10 pt-4 md:pt-0 h-full px-0 md:px-4 gap-2 md:gap-0">
                      <span className="md:hidden type-eyebrow text-on-surface-variant/60">Workspace Default</span>
                      <DebouncedNumericInput
                        label="WS Max Size"
                        unit="MB"
                        min={1}
                        value={defaultPolicy.maxReceiveSizeMb}
                        onChange={(v) => updateWorkspacePolicy({ ...defaultPolicy, maxReceiveSizeMb: v })}
                        className="w-full md:max-w-[140px]"
                      />
                    </div>
                    
                    <div className="flex flex-col md:items-center px-0 md:px-4 gap-2 md:gap-0">
                      <span className="md:hidden type-eyebrow text-secondary/80 font-bold">Environment Override</span>
                      {envOverridePolicy ? (
                        <DebouncedNumericInput
                          label="Env Max Size"
                          unit="MB"
                          min={1}
                          theme="secondary"
                          value={envOverridePolicy.maxReceiveSizeMb}
                          onChange={(v) => updateEnvOverridePolicy({ ...envOverridePolicy, maxReceiveSizeMb: v })}
                          className="w-full md:max-w-[140px]"
                        />
                      ) : (
                        <button 
                          onClick={() => updateEnvOverridePolicy({ ...defaultPolicy })}
                          className="text-[11px] font-bold uppercase tracking-widest text-outline/50 hover:text-secondary hover:bg-secondary/10 px-4 py-2 rounded-lg transition-all border border-transparent hover:border-secondary/20"
                          aria-label="Add environment override for response size"
                        >
                          Override
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {envOverridePolicy && (
                <div className="bg-surface-container/10 border-t border-outline-variant/15 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                  <span className="text-[11px] text-on-surface-variant/60 italic flex items-center gap-2">
                    <Globe size={12} aria-hidden="true" /> Environment-specific overrides for {environment.name} are active.
                  </span>
                  <button
                    onClick={clearEnvOverridePolicy}
                    className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-error transition-colors flex items-center gap-1.5 p-2 rounded-lg hover:bg-error/5"
                  >
                    <Trash2 size={12} aria-hidden="true" /> Reset to Defaults
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* UI Preferences Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2.5 px-1">
              <Activity size={16} className="text-secondary" aria-hidden="true" />
              <h2 className="type-eyebrow text-on-surface-variant/90">Experience & Monitoring</h2>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 items-stretch">
              {/* Performance Spectrum - Visual (3/5) */}
              <div className="xl:col-span-3 flex flex-col">
                <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 md:p-8 flex-1 flex flex-col gap-8 md:gap-10 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity" aria-hidden="true">
                    <Zap size={120} />
                  </div>
                  
                  <div className="space-y-2 relative z-10">
                    <h3 className="text-[14px] font-bold text-on-surface flex items-center gap-2 uppercase tracking-widest">
                      <Palette size={16} className="text-primary" aria-hidden="true" />
                      Latency Mapping
                    </h3>
                    <p className="text-[12px] text-on-surface-variant/70 leading-relaxed max-w-[400px]">
                      Calibrate the visual response times. Requests exceeding these thresholds will be flagged in the activity log.
                    </p>
                  </div>


                  {/* Threshold Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10 relative z-10">
                    <DebouncedNumericInput
                      label="Slow Mark"
                      unit="ms"
                      min={10}
                      value={defaultUI.latencyThresholds.slow}
                      onChange={(v) => updateWorkspaceUI({ ...defaultUI, latencyThresholds: { ...defaultUI.latencyThresholds, slow: v } })}
                    />
                    <DebouncedNumericInput
                      label="Critical Mark"
                      unit="ms"
                      min={100}
                      value={defaultUI.latencyThresholds.critical}
                      onChange={(v) => updateWorkspaceUI({ ...defaultUI, latencyThresholds: { ...defaultUI.latencyThresholds, critical: v } })}
                    />
                  </div>
                </div>
              </div>

              {/* History Archive (2/5) */}
              <div className="xl:col-span-2 flex flex-col">
                <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 flex-1 flex flex-col shadow-inner relative group overflow-hidden">
                  <div className="space-y-2 mb-8 relative z-10">
                    <h3 className="text-[14px] font-bold text-on-surface flex items-center gap-2 uppercase tracking-widest">
                      <Clock size={16} className="text-secondary" aria-hidden="true" />
                      Retention
                    </h3>
                    <p className="text-[12px] text-on-surface-variant/70">Manage the local history buffer.</p>
                  </div>

                  <div className="flex-1 flex flex-col justify-center items-center gap-8">
                    <DebouncedNumericInput
                      min={1}
                      max={500}
                      value={defaultUI.historyRetentionCount}
                      onChange={(v) => updateWorkspaceUI({ ...defaultUI, historyRetentionCount: v })}
                      className="w-48"
                      theme="secondary"
                    />

                    <div className="w-full space-y-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[25, 50, 100, 250, 500].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => updateWorkspaceUI({ ...defaultUI, historyRetentionCount: preset })}
                            className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all border ${defaultUI.historyRetentionCount === preset ? 'bg-secondary border-secondary text-on-secondary shadow-lg shadow-secondary/20' : 'bg-surface-container-high border-outline-variant/40 hover:bg-surface-container-highest text-on-surface-variant'}`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-3 px-4 py-3 bg-secondary/5 border border-secondary/20 rounded-xl">
                        <AlertCircle size={14} className="text-secondary shrink-0" />
                        <p className="text-[12px] font-medium text-on-surface-variant leading-snug">
                          Higher retention increases local memory usage but preserves more context.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

