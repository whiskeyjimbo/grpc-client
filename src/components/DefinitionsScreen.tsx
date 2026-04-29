/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChangeEvent, DragEvent } from 'react';
import { CloudUpload, Wifi, Lock, Network, Server, Trash2, Layers, Globe, Search, Check, Zap, BookOpen, Play } from 'lucide-react';
import type { Workspace, Environment, GrpcService } from '../types.ts';
import { getErrorMessage } from '../utils.ts';
import { importProtoFiles, reflectDefinitions, isForcedDemoMode, setDemoMode, isDemoMode } from '../api.ts';
import { Toggle, ContextBadge, PanelHeader, SectionCard, EmptyState, SearchInput } from './index.ts';
import { ConfirmDialog } from './dialogs.tsx';

export function DefinitionsScreen({
  workspace,
  environment,
  onUpdateWorkspace
}: {
  workspace: Workspace,
  environment: Environment,
  onUpdateWorkspace: (ws: Workspace) => void
}) {
  const [enableTls, setEnableTls] = useState(false);
  const [reflectionTarget, setReflectionTarget] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccessHint, setShowSuccessHint] = useState(() => !localStorage.getItem('grpc_client_onboarded'));
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingDeleteService, setPendingDeleteService] = useState<GrpcService | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workspace.services;
    return workspace.services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.methods.some(m => m.name.toLowerCase().includes(q))
    );
  }, [workspace.services, searchQuery]);

  const mergeWorkspaceServices = useCallback((incomingServices: GrpcService[]) => {
    const merged = new Map<string, GrpcService>();
    workspace.services.forEach((service) => {
      merged.set(service.name, service);
    });
    incomingServices.forEach((service) => {
      merged.set(service.name, service);
    });

    onUpdateWorkspace({
      ...workspace,
      services: Array.from(merged.values()),
    });
  }, [workspace, onUpdateWorkspace]);

  const classifyReflectionError = (error: unknown): string => {
    const msg = getErrorMessage(error).toLowerCase();

    // TLS negotiation failures: check before "connection" patterns since they often co-occur
    if (msg.includes('tls') || msg.includes('certificate') || msg.includes('x509') || msg.includes('handshake')) {
      return 'TLS handshake failed: toggle the TLS switch and retry. The server may require plaintext, or your cert may not be trusted.';
    }

    // Connection-level failures: wrong address, server not running, firewall
    if (
      msg.includes('connect to') ||
      msg.includes('connection refused') ||
      msg.includes('no such host') ||
      msg.includes('i/o timeout') ||
      msg.includes('dial tcp')
    ) {
      return 'Could not reach the server: check the endpoint address and that the server is running.';
    }

    // Connected but timed out before finishing the dial
    if (msg.includes('deadline exceeded') || msg.includes('context deadline')) {
      return 'Connection timed out: the server is reachable but not responding. Check for firewall rules or a misconfigured port.';
    }

    // Reflection RPC not registered on the server
    if (
      msg.includes('unimplemented') ||
      msg.includes('unknown service') ||
      msg.includes('grpc.reflection')
    ) {
      return 'Server reflection is not enabled: add grpc.reflection.Register(s) to the server, or import a .proto file instead.';
    }

    // Auth / permission failure
    if (msg.includes('unauthenticated') || msg.includes('permission denied') || msg.includes('unauthorized')) {
      return 'Authentication required: add authorization headers in the Environments tab and retry.';
    }

    return `Reflection failed: ${getErrorMessage(error)}`;
  };

  const handleConnectReflection = useCallback(async () => {
    const target = reflectionTarget.trim();
    if (!target) {
      setReflectionError('Enter an endpoint address, for example: localhost:50051');
      return;
    }

    setIsConnecting(true);
    setReflectionError(null);

    try {
      const response = await reflectDefinitions({
        target,
        tls: enableTls,
      });

      if (response.services.length === 0) {
        setReflectionError('No services found: the server is running reflection but has not registered any services.');
        return;
      }

      mergeWorkspaceServices(response.services);
    } catch (error) {
      setReflectionError(classifyReflectionError(error));
    } finally {
      setIsConnecting(false);
    }
  }, [reflectionTarget, enableTls, mergeWorkspaceServices]);

  const handleImportFiles = useCallback(async (files: File[]) => {
    const protoFiles = files.filter((file) => file.name.toLowerCase().endsWith('.proto'));
    if (protoFiles.length === 0) {
      setImportError('Select at least one .proto file to import.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const response = await importProtoFiles(protoFiles);
      if (response.services.length === 0) {
        setImportError('No service definitions were found in the uploaded proto files.');
        return;
      }

      mergeWorkspaceServices(response.services);
    } catch (error) {
      setImportError(`Proto import failed: ${getErrorMessage(error)}`);
    } finally {
      setIsImporting(false);
    }
  }, [mergeWorkspaceServices]);

  const toFileArray = (fileList: FileList | null): File[] => {
    if (!fileList) {
      return [];
    }

    const files: File[] = [];
    for (let index = 0; index < fileList.length; index += 1) {
      const file = fileList.item(index);
      if (file) {
        files.push(file);
      }
    }
    return files;
  };

  const handleSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = toFileArray(event.target.files);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    void handleImportFiles(files);
  };

  const handleDropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const allFiles = toFileArray(event.dataTransfer.files);
    const protoFiles = allFiles.filter(f => f.name.endsWith('.proto'));
    if (allFiles.length > 0 && protoFiles.length === 0) {
      setImportError(`Only .proto files are accepted. Dropped: ${allFiles.map(f => f.name).join(', ')}`);
      return;
    }
    if (protoFiles.length === 0) return;
    void handleImportFiles(protoFiles);
  };

  const dismissHint = useCallback(() => {
    localStorage.setItem('grpc_client_onboarded', 'true');
    setShowSuccessHint(false);
  }, []);

  const handleClearDefinitions = () => {
    setClearDialogOpen(true);
  };

  const confirmClearDefinitions = () => {
    setClearDialogOpen(false);
    onUpdateWorkspace({ ...workspace, services: [] });
  };

  const handleRemoveService = (service: GrpcService) => {
    setPendingDeleteService(service);
  };

  const confirmRemoveService = () => {
    if (!pendingDeleteService) return;
    const updatedWs = { 
      ...workspace, 
      services: workspace.services.filter(s => s.id !== pendingDeleteService.id) 
    };
    onUpdateWorkspace(updatedWs);
    setPendingDeleteService(null);
  };

  return (
    <>
    <div className="h-full flex flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".proto"
        multiple
        className="hidden"
        onChange={handleSelectFiles}
      />

      {/* Panel header: matches Workbench register */}
      <PanelHeader
        icon={<BookOpen size={14} aria-hidden="true" />}
        title={<span className="type-display text-on-surface">Protobuf Definitions</span>}
        context={
          <>
            <ContextBadge role="workspace" icon={<Layers size={10} aria-hidden="true" />} label={workspace.name} />
            <ContextBadge role="environment" icon={<Globe size={10} aria-hidden="true" />} label={environment.name} />
          </>
        }
        actions={
          <>
            {workspace.services.length > 0 && (
              <button
                onClick={handleClearDefinitions}
                className="flex items-center gap-1.5 px-3 py-1 text-outline hover:text-error hover:bg-error/5 rounded type-btn transition active:scale-95"
                aria-label="Clear all service definitions"
              >
                <Trash2 size={11} aria-hidden="true" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || isDemoMode()}
              className="flex items-center gap-1.5 px-3 py-1 bg-primary text-on-primary type-btn rounded active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition"
              title={isDemoMode() ? 'Disabled in Demo' : undefined}
            >
              <CloudUpload size={11} aria-hidden="true" />
              <span className="hidden xs:inline">
                {isImporting ? 'Importing...' : 'Import .proto'}
              </span>
              <span className="xs:hidden">
                {isImporting ? '...' : 'Import'}
              </span>
            </button>
          </>
        }
      />

      {/* Two-panel split: load mechanisms | loaded services */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: load mechanisms */}
        <div className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-outline-variant/30 flex flex-col gap-4 bg-background overflow-y-auto custom-scrollbar p-4 max-h-[50vh] md:max-h-none">
          <SectionCard
              header={
                <>
                  <CloudUpload size={14} className="text-on-surface-variant/70" aria-hidden="true" />
                  <span className="type-label text-on-surface-variant">Upload .proto</span>
                  <span className="type-label text-on-surface-variant/60 ml-auto">Local</span>
                </>
              }
              disabled={isDemoMode()}
              disabledMessage="Disabled in Demo"
          >
            <div className="p-4">
            <div
              role="button"
              tabIndex={0}
              onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDropFiles}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload .proto files"
              aria-describedby="import-hint"
              className={`border border-dashed rounded p-6 flex flex-col items-center gap-2 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isDragOver
                  ? 'border-primary bg-primary/5 scale-[1.02]'
                  : 'border-outline-variant/30 bg-surface-dim hover:bg-surface-container/40 hover:border-outline-variant/60'
              }`}
            >
              <motion.div
                animate={isDragOver ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <CloudUpload size={18} className={`transition-colors ${isDragOver ? 'text-primary' : 'text-on-surface-variant/40 group-hover:text-on-surface-variant/70'}`} aria-hidden="true" />
              </motion.div>
              <p id="import-hint" className="text-xs font-medium text-on-surface-variant text-center">
                {isDragOver ? 'Release to import' : 'Drop .proto files here or click to browse'}
              </p>
            </div>
            <div aria-live="polite" role="alert">
              <AnimatePresence>
                {importError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-3 text-xs text-error"
                  >{importError}</motion.p>
                )}
              </AnimatePresence>
            </div>
            </div>
          </SectionCard>

          <SectionCard
              header={
                <>
                  <Wifi size={14} className="text-on-surface-variant/70" aria-hidden="true" />
                  <span className="type-label text-on-surface-variant">Server Reflection</span>
                  <span className="type-label text-on-surface-variant/60 ml-auto">Dynamic</span>
                </>
              }
          >
            <div className="p-4 space-y-3">
              <div>
                <label htmlFor="reflection-target" className="type-label text-on-surface-variant block mb-1.5">Endpoint Address</label>
                <div className="relative">
                  <input
                    id="reflection-target"
                    type="text"
                    placeholder="localhost:50051"
                    value={reflectionTarget}
                    onChange={(event) => setReflectionTarget(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleConnectReflection();
                      }
                    }}
                    className="w-full bg-surface-dim border border-outline-variant/50 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary transition-colors outline-none"
                  />
                  <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${isConnecting ? 'bg-primary animate-pulse' : 'bg-outline-variant/50'}`} aria-hidden="true" />
                </div>
              </div>

              <label className="flex items-center justify-between py-2 px-3 bg-surface-dim rounded border border-outline-variant/20 cursor-pointer min-h-[44px]">
                <div className="flex items-center gap-2">
                  <Lock size={12} className="text-on-surface-variant/70" aria-hidden="true" />
                  <span className="text-xs font-medium">Use TLS</span>
                </div>
                <Toggle
                  checked={enableTls}
                  onChange={setEnableTls}
                  aria-label="Use TLS (secure connection)"
                  size="sm"
                />
              </label>

              <div aria-live="polite" role="alert">
                {reflectionError && (
                  <div className="space-y-1">
                    <p className="text-xs text-error">{reflectionError}</p>
                    <p className="text-xs text-on-surface-variant/70 font-mono leading-relaxed">
                      Check: server is reachable, reflection is enabled (<span className="text-on-surface-variant">--reflection</span> flag), and TLS matches the endpoint.
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => { void handleConnectReflection(); }}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 py-1.5 bg-primary text-on-primary type-btn rounded hover:opacity-90 active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <motion.div
                    animate={{ 
                      rotate: [0, 90, 180, 270, 360],
                      scale: [1, 0.9, 1, 0.9, 1]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 2, 
                      ease: "easeInOut",
                      times: [0, 0.25, 0.5, 0.75, 1]
                    }}
                    className="flex items-center justify-center"
                  >
                    <Zap size={12} aria-hidden="true" />
                  </motion.div>
                ) : (
                  <Server size={12} aria-hidden="true" />
                )}
                {isConnecting ? 'Querying reflection API...' : 'Connect & Reflect'}
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Right: loaded services list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <PanelHeader
            icon={<Network size={12} aria-hidden="true" />}
            title={<span className="type-label text-on-surface-variant">Loaded Services</span>}
            actions={<span className="text-xs font-mono bg-surface-container-highest px-2 py-0.5 rounded text-on-surface-variant/80">{workspace.services.length}</span>}
          />
          {workspace.services.length > 0 && (
            <div className="px-4 py-3 border-b border-outline-variant/20 shrink-0">
              <SearchInput
                placeholder="Filter services or methods..."
                value={searchQuery}
                onChange={setSearchQuery}
                onClear={() => setSearchQuery('')}
                ariaLabel="Filter services"
                className="w-full"
              />
            </div>
          )}
          <AnimatePresence>
            {workspace.services.length > 0 && showSuccessHint && (
              <motion.div
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-primary/10 shrink-0 overflow-hidden"
              >
                <div className="px-4 py-3 bg-primary/5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} className="text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-primary mb-0.5">Service loaded.</p>
                    <p className="text-xs text-primary/70 leading-relaxed">
                      Switch to the <strong className="font-semibold">Workbench</strong> tab to select a method and send your first request.
                    </p>
                  </div>
                  <button
                    onClick={dismissHint}
                    className="text-primary/40 hover:text-primary transition p-1 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    aria-label="Dismiss hint"
                  >
                    <Zap size={11} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {workspace.services.length === 0 ? (
              <div className="p-8 h-full flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="w-14 h-14 rounded-2xl border border-outline-variant/20 flex items-center justify-center mb-5 bg-surface-container-low relative"
                >
                  <Network size={26} className="text-primary/50" aria-hidden="true" />
                  <motion.span
                    className="absolute inset-0 rounded-2xl border border-primary/20"
                    animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.12, 1] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="type-label text-on-surface mb-2"
                >
                  No Signal Yet
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="text-xs text-on-surface-variant/70 leading-relaxed mb-6"
                >
                  Point this tool at a running gRPC server or drop in a .proto file. Once a service is loaded, you can explore every method and send real requests.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col gap-3 w-full"
                >
                  <button
                    onClick={() => document.getElementById('reflection-target')?.focus()}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary hover:bg-primary/20 type-btn rounded transition active:scale-95"
                  >
                    <Wifi size={14} aria-hidden="true" />
                    Reflect from a live server
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isDemoMode()}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-outline-variant/30 text-on-surface hover:bg-surface-container-high type-btn rounded transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CloudUpload size={14} aria-hidden="true" />
                    {isDemoMode() ? 'Importing Disabled' : 'Import a .proto file'}
                  </button>
                  {!isDemoMode() && (
                    <button
                      onClick={() => { setDemoMode(true); window.location.reload(); }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-secondary/10 text-secondary hover:bg-secondary/20 type-btn rounded transition active:scale-95"
                    >
                      <Play size={14} aria-hidden="true" />
                      Launch Interactive Demo
                    </button>
                  )}
                </motion.div>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="p-6 h-full flex items-center justify-center">
                <EmptyState
                  icon={<Search size={22} className="text-outline/15" aria-hidden="true" />}
                  message="No services match your search."
                  size="lg"
                />
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                <AnimatePresence initial={false}>
                  {filteredServices.map((service, index) => (
                    <motion.li
                      key={service.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.2, delay: index < 15 ? Math.min(index * 0.04, 0.24) : 0, ease: [0.16, 1, 0.3, 1] }}
                      className="px-4 py-3 hover:bg-surface-container/50 transition-colors group flex items-start gap-3"
                    >
                      <Network size={12} className="text-on-surface-variant/40 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span 
                            className="font-mono text-xs font-medium text-on-surface truncate" 
                            aria-label={`Service: ${service.name}`}
                          >
                            {service.name}
                          </span>
                          <span className="text-xs text-on-surface-variant/60 font-mono shrink-0" aria-label={`${service.methods.length} methods`}>
                            {service.methods.length} {service.methods.length === 1 ? 'method' : 'methods'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5" aria-label="Available methods preview">
                          {service.methods.slice(0, 6).map(m => (
                            <span key={m.id} className="text-xs font-mono text-on-surface-variant/50">{m.name}</span>
                          ))}
                          {service.methods.length > 6 && (
                            <span className="text-xs text-on-surface-variant/40 italic">+{service.methods.length - 6} more</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveService(service)}
                        className="p-3 -m-1.5 text-on-surface-variant/40 opacity-100 md:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-error hover:bg-error/10 rounded transition shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label={`Remove ${service.name} service`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
      <ConfirmDialog
        isOpen={clearDialogOpen}
        title="Clear service definitions?"
        message={`Remove all ${workspace.services.length} loaded service definition${workspace.services.length === 1 ? '' : 's'} from "${workspace.name}"? This cannot be undone.`}
        confirmLabel="Clear All"
        isDanger
        onConfirm={confirmClearDefinitions}
        onCancel={() => setClearDialogOpen(false)}
      />
      <ConfirmDialog
        isOpen={!!pendingDeleteService}
        title="Remove service definition?"
        message={`Remove the "${pendingDeleteService?.name}" service definition? You can re-import or reflect it later.`}
        confirmLabel="Remove Service"
        isDanger
        onConfirm={confirmRemoveService}
        onCancel={() => setPendingDeleteService(null)}
      />
    </>
  );
}

