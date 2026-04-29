/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Play, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType, GrpcService, HistoryItem, Workspace, Environment } from './types.ts';
import { MOCK_HISTORY, MOCK_WORKSPACES, MOCK_ENVIRONMENTS } from './lib/constants.ts';
import { appendHistory, deleteEnvironment, deleteHistory, deleteHistoryBulk, deleteWorkspace, fetchBootstrap, upsertEnvironment, upsertWorkspace, isDemoMode, setDemoMode, isForcedDemoMode } from './api/index.ts';
import { DefinitionsScreen } from './components/screens/DefinitionsScreen.tsx';
import { HistoryScreen } from './components/screens/HistoryScreen.tsx';
import { VariablesScreen } from './components/screens/VariablesScreen.tsx';
import { ConfigScreen } from './components/screens/ConfigScreen.tsx';
import { WorkbenchScreen } from './components/screens/WorkbenchScreen.tsx';
import { ConfirmDialog, Modal, HelpPanel } from './components/Dialogs.tsx';
import { Header, ContextBar, Sidebar, LandscapeRail, BottomNav } from './components/layout/index.ts';
import { createEntityID, getErrorMessage, type Toast } from './lib/utils.ts';
import { PALETTES } from './lib/themes.ts';

// Apply saved theme immediately to avoid flash on load
{
  const savedId = (() => { try { return localStorage.getItem('grpc-theme') ?? 'amber'; } catch { return 'amber'; } })();
  const savedPalette = PALETTES.find(p => p.id === savedId) ?? PALETTES[0];
  const root = document.documentElement;
  Object.entries(savedPalette.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.classList.add(`theme-${savedId}`);
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
    // Suppress benign ResizeObserver loop errors from layout animations
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
