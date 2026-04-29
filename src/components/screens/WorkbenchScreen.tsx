/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { motion } from 'motion/react';
import {
  Layers, Search, Terminal as TerminalIcon
} from 'lucide-react';
import type { Workspace, Environment, GrpcService, GrpcMethod, EnvVariable, HistoryItem, ViewType, MetadataHeader } from '../../types.ts';
import { createEntityID, sanitizeRequestDataForFields, getErrorMessage, maskValue, cleanPayload } from '../../lib/utils.ts';
import { WorkbenchSidebar } from './workbench/WorkbenchSidebar.tsx';
import { executeRequest } from '../../api/index.ts';
import { WorkspaceProvider, useWorkspace, useRequestData } from './workbench/WorkspaceContext.tsx';
import { ExecutionContext } from './workbench/ExecutionContext.tsx';
import { RequestEditor } from './workbench/RequestEditor.tsx';
import { WorkbenchResponsePanel } from './workbench/WorkbenchResponsePanel.tsx';

export function WorkbenchScreen(props: {
  initialRequest: HistoryItem | null,
  initialMethodId?: string | null,
  workspace: Workspace,
  environment: Environment,
  services: GrpcService[],
  globalSearchQuery: string,
  onDeleteService: (id: string) => void,
  onLogHistory: (item: HistoryItem) => void,
  onClearReplayItem: () => void,
  onMethodSelect?: (id: string) => void,
  onNavigate?: (view: ViewType) => void,
  onUpdateWorkspace: (ws: Workspace) => void,
  onUpdateEnvironment: (e: Environment) => void,
  onShowToast: (tone: 'success' | 'error', message: string, onUndo?: () => void) => void,
}) {
  return (
    <WorkspaceProvider workspaceId={props.workspace.id}>
      <WorkbenchContent {...props} />
    </WorkspaceProvider>
  );
}

function WorkbenchContent({
  initialRequest,
  initialMethodId,
  workspace,
  environment,
  services,
  globalSearchQuery,
  onDeleteService,
  onLogHistory,
  onClearReplayItem,
  onMethodSelect,
  onNavigate,
  onUpdateWorkspace,
  onUpdateEnvironment,
  onShowToast,
}: {
  initialRequest: HistoryItem | null,
  initialMethodId?: string | null,
  workspace: Workspace,
  environment: Environment,
  services: GrpcService[],
  globalSearchQuery: string,
  onDeleteService: (id: string) => void,
  onLogHistory: (item: HistoryItem) => void,
  onClearReplayItem: () => void,
  onMethodSelect?: (id: string) => void,
  onNavigate?: (view: ViewType) => void,
  onUpdateWorkspace: (ws: Workspace) => void,
  onUpdateEnvironment: (e: Environment) => void,
  onShowToast: (tone: 'success' | 'error', message: string, onUndo?: () => void) => void,
}) {
  const {
    response,
    setResponse,
    isExecuting,
    setIsExecuting,
    selectedMethod,
    setSelectedMethod,
    varOverrides,
    setVarOverrides,
    headerOverrides,
    setHeaderOverrides,
    contextOpen,
    setContextOpen
  } = useWorkspace();
  const { requestData, setRequestData } = useRequestData();

  const [expandedServices, setExpandedServices] = useState<string[]>(() => {
    if (initialMethodId) {
      const svc = services.find(s => s.methods.some(m => m.id === initialMethodId));
      if (svc) return [svc.id];
    }
    return ['s1'];
  });

  useEffect(() => {
    if (initialMethodId) {
      const found = services.flatMap(s => s.methods).find(m => m.id === initialMethodId);
      if (found) setSelectedMethod(found);
    } else if (!selectedMethod) {
      setSelectedMethod(services[0]?.methods[0] || null);
    }
  }, [initialMethodId, services, setSelectedMethod, selectedMethod]);

  const abortControllerRef = useRef<AbortController | null>(null);
  type ResponseTab = 'response' | 'grpcurl' | 'curl';
  const [responseTab, setResponseTab] = useState<ResponseTab>('response');
  const parsedResponseBody = useMemo(() => {
    if (!response || response.messages) return null;
    try {
      return JSON.parse(response.body);
    } catch {
      return { raw: response.body };
    }
  }, [response]);

  const [unresolvedWarning, setUnresolvedWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(false);
  const [responsePanelWidth, setResponsePanelWidth] = useState(() => {
    try { return Number(localStorage.getItem('grpc:ui:responsePanelWidth')) || 380; } catch { return 380; }
  });
  const [isMethodsCollapsed, setIsMethodsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('grpc:ui:methodsCollapsed');
      if (saved !== null) return saved === 'true';
      return window.innerWidth < 768;
    } catch { return window.innerWidth < 768; }
  });
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<'methods' | 'request' | 'response'>('request');
  const panelDragRef = useRef<{ active: boolean; startX: number; startWidth: number; startY: number; startHeight: number }>({ active: false, startX: 0, startWidth: 0, startY: 0, startHeight: 0 });
  const responsePanelWidthRef = useRef(responsePanelWidth);
  const [endpointQuickTarget, setEndpointQuickTarget] = useState('');

  useEffect(() => {
    localStorage.setItem('grpc:ui:methodsCollapsed', String(isMethodsCollapsed));
  }, [isMethodsCollapsed]);

  useEffect(() => { responsePanelWidthRef.current = responsePanelWidth; }, [responsePanelWidth]);
  const normalizedGlobalSearch = globalSearchQuery.trim().toLowerCase();
  const isFilteringServices = Boolean(normalizedGlobalSearch);

  const editingVariables = useMemo(() => {
    const wsGlobal = workspace.variables || [];
    const envSpecific = workspace.envOverrides?.[environment.id]?.variables || [];
    const baseEnv = environment.variables || [];
    const map = new Map();
    baseEnv.forEach(v => map.set(v.key, v));
    wsGlobal.forEach(v => map.set(v.key, v));
    envSpecific.forEach(v => map.set(v.key, v));
    return Array.from(map.values() as IterableIterator<EnvVariable>);
  }, [workspace, environment]);

  const effectiveVariables = useMemo(
    () => varOverrides ?? editingVariables,
    [varOverrides, editingVariables],
  );

  const editingHeaders = useMemo(() => {
    const wsGlobal = workspace.headers || [];
    const envSpecific = workspace.envOverrides?.[environment.id]?.headers || [];
    const baseEnv = environment.headers || [];
    const map = new Map();
    baseEnv.forEach(h => map.set(h.key, h));
    wsGlobal.forEach(h => map.set(h.key, h));
    envSpecific.forEach(h => map.set(h.key, h));
    return Array.from(map.values() as IterableIterator<MetadataHeader>);
  }, [workspace, environment]);

  const effectiveHeaders = useMemo(
    () => headerOverrides ?? editingHeaders,
    [headerOverrides, editingHeaders],
  );

  const editingVariablesTier = useMemo(() => {
    const m = new Map<string, 'ENV' | 'WS' | 'OVERRIDE'>();
    for (const v of (environment.variables || [])) if (v.key) m.set(v.key, 'ENV');
    for (const v of (workspace.variables || [])) if (v.key) m.set(v.key, 'WS');
    for (const v of (workspace.envOverrides?.[environment.id]?.variables || [])) if (v.key) m.set(v.key, 'OVERRIDE');
    return m;
  }, [workspace, environment]);

  const editingHeadersTier = useMemo(() => {
    const m = new Map<string, 'ENV' | 'WS' | 'OVERRIDE'>();
    for (const h of (environment.headers || [])) if (h.key) m.set(h.key, 'ENV');
    for (const h of (workspace.headers || [])) if (h.key) m.set(h.key, 'WS');
    for (const h of (workspace.envOverrides?.[environment.id]?.headers || [])) if (h.key) m.set(h.key, 'OVERRIDE');
    return m;
  }, [workspace, environment]);

  const connectionPolicy = useMemo(() => {
    return workspace.envOverrides?.[environment.id]?.connectionPolicy ||
      workspace.connectionPolicy ||
      { enableTls: false, timeoutMs: 5000, maxReceiveSizeMb: 4 };
  }, [workspace, environment.id]);

  const uiConfig = useMemo(() => {
    return workspace.envOverrides?.[environment.id]?.uiConfig ||
      workspace.uiConfig ||
      { latencyThresholds: { slow: 100, critical: 1000 } };
  }, [workspace, environment.id]);

  const resolvedEndpoint = useMemo(() => {
    const endpointKeys = new Set(['HOST', 'GRPC_TARGET', 'ENDPOINT', 'TARGET', 'URL']);
    const endpointVariable = effectiveVariables.find((variable) => endpointKeys.has(variable.key.trim().toUpperCase()));

    const variableValue = endpointVariable?.value?.trim();
    if (variableValue) {
      return variableValue;
    }

    return environment.name.trim();
  }, [effectiveVariables, environment.name]);

  const hasEndpoint = useMemo(() => {
    const endpointKeys = new Set(['HOST', 'GRPC_TARGET', 'ENDPOINT', 'TARGET', 'URL']);
    return effectiveVariables.some(v => endpointKeys.has(v.key.trim().toUpperCase()) && !!v.value?.trim());
  }, [effectiveVariables]);

  const canExecute = !!selectedMethod && hasEndpoint;

  const selectedServiceName = useMemo(() =>
    services.find(s => s.methods.some(m => m.id === selectedMethod?.id))?.name,
    [services, selectedMethod]
  );

  const grpcurlCmd = useMemo(() => {
    if (!selectedMethod) return '# Select a method to preview the grpcurl command.';

    const grpcPath = selectedMethod.fullName
      ? selectedMethod.fullName.replace(/\.([^.]+)$/, '/$1')
      : selectedMethod.name;
    const cleanEndpoint = resolvedEndpoint.replace(/^https?:\/\//, '');
    const payload = JSON.stringify(cleanPayload(requestData), null, 2);

    const lines: string[] = ['grpcurl'];
    if (!connectionPolicy.enableTls) {
      lines.push('  -plaintext');
    } else if (connectionPolicy.insecureTls) {
      lines.push('  -insecure');
    }
    for (const h of effectiveHeaders) {
      if (h.key) lines.push(`  -H "${h.key}: ${maskValue(h.key, h.value)}"`);
    }
    lines.push(`  -d '${payload.replace(/'/g, "'\\''")}'`);
    lines.push(`  ${cleanEndpoint}`);
    lines.push(`  ${grpcPath}`);

    return lines.join(' \\\n');
  }, [selectedMethod, requestData, effectiveHeaders, connectionPolicy, resolvedEndpoint]);

  const curlCmd = useMemo(() => {
    if (!selectedMethod) return '# Select a method to preview the cURL command.';

    const grpcPath = selectedMethod.fullName
      ? selectedMethod.fullName.replace(/\.([^.]+)$/, '/$1')
      : selectedMethod.name;
    const cleanEndpoint = resolvedEndpoint.replace(/^https?:\/\//, '');
    const protocol = connectionPolicy.enableTls ? 'https' : 'http';
    const payload = JSON.stringify(cleanPayload(requestData));

    const lines: string[] = ['curl -Ss'];
    if (connectionPolicy.insecureTls) {
      lines.push('  --insecure');
    }
    lines.push(`  -H 'Content-Type: application/json'`);
    lines.push(`  -H 'Connect-Protocol-Version: 1'`);
    for (const h of effectiveHeaders) {
      if (h.key) lines.push(`  -H "${h.key}: ${maskValue(h.key, h.value)}"`);
    }
    lines.push(`  -d '${payload.replace(/'/g, "'\\''")}'`);
    lines.push(`  ${protocol}://${cleanEndpoint}/${grpcPath}`);

    return lines.join(' \\\n');
  }, [selectedMethod, requestData, effectiveHeaders, connectionPolicy, resolvedEndpoint]);

  const filteredServices = useMemo(() => {
    if (!normalizedGlobalSearch) return services;

    return services
      .map((service) => {
        const methods = service.methods.filter((method) => {
          const methodName = method.name.toLowerCase();
          const serviceName = service.name.toLowerCase();
          return methodName.includes(normalizedGlobalSearch) || serviceName.includes(normalizedGlobalSearch);
        });
        return { ...service, methods };
      })
      .filter((service) => service.methods.length > 0);
  }, [services, normalizedGlobalSearch]);

  const resolveReplayTarget = useCallback((historyMethod: string): { service: GrpcService; method: GrpcMethod } | null => {
    const rawMethod = historyMethod.trim();
    if (!rawMethod) return null;

    const allMethods = services.flatMap((service) =>
      service.methods.map((method) => ({ service, method })),
    );

    const normalizedRaw = rawMethod.toLowerCase();
    const slashParts = rawMethod.split('/').map((segment) => segment.trim()).filter(Boolean);
    const dotParts = rawMethod.split('.').map((segment) => segment.trim()).filter(Boolean);

    let methodHint = rawMethod;
    let serviceHint = '';
    let fullNameHint = '';

    if (slashParts.length >= 2) {
      methodHint = slashParts[slashParts.length - 1];
      const servicePath = slashParts.slice(0, slashParts.length - 1).join('/');
      const servicePathDot = servicePath.replace(/\//g, '.');
      serviceHint = servicePathDot.split('.').pop() || '';
      fullNameHint = `${servicePathDot}.${methodHint}`;
    } else if (dotParts.length >= 2) {
      methodHint = dotParts[dotParts.length - 1];
      serviceHint = dotParts[dotParts.length - 2];
      fullNameHint = rawMethod;
    }

    const normalizedMethodHint = methodHint.toLowerCase();
    const normalizedServiceHint = serviceHint.toLowerCase();
    const normalizedFullNameHint = fullNameHint.toLowerCase();

    const byFullName = allMethods.find((entry) => {
      const fullName = entry.method.fullName?.trim().toLowerCase();
      if (!fullName) return false;
      return fullName === normalizedRaw || (normalizedFullNameHint !== '' && fullName === normalizedFullNameHint);
    });
    if (byFullName) return byFullName;

    const byServicePath = allMethods.find((entry) => {
      const slashPath = `${entry.service.name}/${entry.method.name}`.toLowerCase();
      const dotPath = `${entry.service.name}.${entry.method.name}`.toLowerCase();
      return slashPath === normalizedRaw || dotPath === normalizedRaw;
    });
    if (byServicePath) return byServicePath;

    if (normalizedServiceHint) {
      const byServiceAndMethod = allMethods.find((entry) => (
        entry.service.name.toLowerCase() === normalizedServiceHint &&
        entry.method.name.toLowerCase() === normalizedMethodHint
      ));
      if (byServiceAndMethod) return byServiceAndMethod;
    }

    const byMethodName = allMethods.find((entry) => {
      const normalizedMethodName = entry.method.name.toLowerCase();
      return normalizedMethodName === normalizedRaw || normalizedMethodName === normalizedMethodHint;
    });

    return byMethodName || null;
  }, [services]);

  const toggleService = useCallback((id: string) => {
    setExpandedServices(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }, []);

  const handleExecute = useCallback(async (bypassWarning = false) => {
    if (!selectedMethod) return;
    if (!hasEndpoint) return;

    const resolvedKeys = new Set(effectiveVariables.map(v => v.key));
    const unresolvedVars = new Set<string>();
    const varPattern = /\{\{([^}]+)\}\}/g;
    const scanValue = (v: unknown) => {
      if (typeof v === 'string') {
        for (const m of v.matchAll(varPattern)) {
          if (!resolvedKeys.has(m[1])) unresolvedVars.add(m[1]);
        }
      } else if (v && typeof v === 'object') {
        Object.values(v).forEach(scanValue);
      }
    };
    Object.values(requestData).forEach(scanValue);
    if (!bypassWarning && unresolvedVars.size > 0) {
      const list = [...unresolvedVars].map(k => `{{${k}}}`).join(', ');
      setUnresolvedWarning(`${unresolvedVars.size} variable${unresolvedVars.size > 1 ? 's' : ''} ${unresolvedVars.size > 1 ? 'are' : 'is'} not defined: ${list}. The raw placeholder${unresolvedVars.size > 1 ? 's' : ''} will be sent as-is.`);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsExecuting(true);
    setResponse(null);
    setUnresolvedWarning(null);
    const executePayload = sanitizeRequestDataForFields(requestData, selectedMethod.requestFields);

    try {
      const newResponse = await executeRequest({
        method: selectedMethod,
        requestPayload: executePayload,
        endpoint: resolvedEndpoint,
        tls: connectionPolicy.enableTls,
        timeoutMs: connectionPolicy.timeoutMs,
        signal: controller.signal,
      });

      const selectedService = services.find((service) => (
        service.methods.some((method) => method.id === selectedMethod.id)
      ));
      const historyMethod = selectedService
        ? `${selectedService.name}/${selectedMethod.name}`
        : selectedMethod.name;

      setResponse(newResponse);
      setResponseTab('response');
      onLogHistory({
        id: createEntityID('h'),
        timestamp: new Date().toISOString(),
        method: historyMethod,
        endpoint: resolvedEndpoint,
        status: newResponse.statusText as any,
        latency: `${newResponse.timeMs}ms`,
        requestPayload: executePayload,
        responsePayload: newResponse.messages || (() => {
          try {
            return JSON.parse(newResponse.body);
          } catch {
            return { raw: newResponse.body };
          }
        })(),
        responseHeaders: Object.keys(newResponse.headers).length > 0 ? newResponse.headers : undefined,
        requestHeaders: effectiveHeaders.length > 0 ? effectiveHeaders : undefined,
        environmentId: environment.id,
        environmentName: environment.name,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        resolvedVariables: effectiveVariables
      });
      if (initialRequest) {
        onClearReplayItem();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = getErrorMessage(error);
      setResponse({
        status: 13,
        statusText: 'INTERNAL',
        body: JSON.stringify({ error: message }, null, 2),
        headers: {},
        timeMs: 0,
      });
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
    }
  }, [selectedMethod, hasEndpoint, effectiveVariables, requestData, resolvedEndpoint, connectionPolicy, services, effectiveHeaders, environment, workspace, initialRequest, onLogHistory, onClearReplayItem, setIsExecuting, setResponse, setUnresolvedWarning]);

  const handleExecuteRef = useRef(handleExecute);
  handleExecuteRef.current = handleExecute;

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleExecuteRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (selectedMethod && !services.some(s => s.methods.some(m => m.id === selectedMethod.id))) {
      setSelectedMethod(null);
    }
  }, [services, selectedMethod, setSelectedMethod]);

  useEffect(() => {
    if (!selectedMethod) {
      setRequestData({});
      return;
    }

    if (!initialRequest) {
      let restored: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(`grpc:req:${workspace.id}:${selectedMethod.id}`);
        if (raw) restored = JSON.parse(raw) as Record<string, any>;
      } catch { /* storage unavailable */ }
      setRequestData(sanitizeRequestDataForFields(restored, selectedMethod.requestFields));
    } else {
      setRequestData((previous) => sanitizeRequestDataForFields(previous, selectedMethod.requestFields));
    }
  }, [selectedMethod, workspace.id, initialRequest, setRequestData]);

  useEffect(() => {
    if (!initialRequest) {
      setVarOverrides(null);
      setHeaderOverrides(null);
      return;
    }

    setResponse(null);

    const replayTarget = resolveReplayTarget(initialRequest.method);
    if (!replayTarget) {
      setRequestData({});
      setSelectedMethod(null);
      setVarOverrides(null);
      setHeaderOverrides(null);
      return;
    }

    setRequestData(sanitizeRequestDataForFields(initialRequest.requestPayload, replayTarget.method.requestFields));
    setSelectedMethod(replayTarget.method);
    setExpandedServices((previous) => (
      previous.includes(replayTarget.service.id)
        ? previous
        : [...previous, replayTarget.service.id]
    ));
    setVarOverrides(
      initialRequest.resolvedVariables && initialRequest.resolvedVariables.length > 0
        ? initialRequest.resolvedVariables
        : null,
    );
    setHeaderOverrides(
      initialRequest.requestHeaders && initialRequest.requestHeaders.length > 0
        ? initialRequest.requestHeaders
        : null,
    );
    if ((initialRequest.resolvedVariables && initialRequest.resolvedVariables.length > 0) ||
        (initialRequest.requestHeaders && initialRequest.requestHeaders.length > 0)) {
      setContextOpen(true);
    }
  }, [initialRequest, services, setVarOverrides, setHeaderOverrides, setResponse, setRequestData, setSelectedMethod, setContextOpen]);

  const isMobileWorkbench = typeof window !== 'undefined' && (window.innerWidth < 768 || window.innerHeight < 500);

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden relative">
      {/* Mobile Workbench Tabs */}
      {isMobileWorkbench && (
        <div className="flex bg-surface-container-low border-b border-outline-variant/20 shrink-0 h-10 landscape:h-8 px-2">
          {(['methods', 'request', 'response'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveWorkbenchTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
                activeWorkbenchTab === tab ? 'text-primary' : 'text-outline/60'
              }`}
            >
              {tab}
              {tab === 'response' && isExecuting && (
                 <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                />
              )}
              {activeWorkbenchTab === tab && (
                <motion.div
                  layoutId="workbench-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {(!isMobileWorkbench || activeWorkbenchTab === 'methods') && (
        <WorkbenchSidebar
          services={services}
          globalSearchQuery={globalSearchQuery}
          expandedServices={expandedServices}
          isFilteringServices={isFilteringServices}
          toggleService={toggleService}
          onDeleteService={onDeleteService}
          selectedMethod={selectedMethod}
          setSelectedMethod={setSelectedMethod}
          onMethodSelect={onMethodSelect}
          initialRequest={initialRequest}
          onClearReplayItem={onClearReplayItem}
          isExecuting={isExecuting}
          onNavigate={onNavigate}
          filteredServices={filteredServices}
          isCollapsed={isMobileWorkbench ? false : isMethodsCollapsed}
          onToggleCollapse={() => setIsMethodsCollapsed(prev => !prev)}
        />
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Request Column: Editor + Execution Context */}
        {(!isMobileWorkbench || activeWorkbenchTab === 'request') && (
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <RequestEditor
              workspace={workspace}
              environment={environment}
              services={services}
              effectiveVariables={effectiveVariables}
              endpointQuickTarget={endpointQuickTarget}
              setEndpointQuickTarget={setEndpointQuickTarget}
              onUpdateEnvironment={onUpdateEnvironment}
              hasEndpoint={hasEndpoint}
              selectedServiceName={selectedServiceName}
            />

            <ExecutionContext
              workspace={workspace}
              environment={environment}
              effectiveVariables={effectiveVariables}
              effectiveHeaders={effectiveHeaders}
              editingVariables={editingVariables}
              editingHeaders={editingHeaders}
              editingVariablesTier={editingVariablesTier}
              editingHeadersTier={editingHeadersTier}
              resolvedEndpoint={resolvedEndpoint}
              connectionPolicy={connectionPolicy}
              onUpdateWorkspace={onUpdateWorkspace}
              onUpdateEnvironment={onUpdateEnvironment}
              onShowToast={onShowToast}
              onExecute={handleExecute}
              onAbort={handleAbort}
              unresolvedWarning={unresolvedWarning}
              setUnresolvedWarning={setUnresolvedWarning}
              initialRequest={initialRequest}
              onClearReplayItem={onClearReplayItem}
              canExecute={canExecute}
            />
          </div>
        )}

        {/* Resizer - Hide on Mobile Tabs */}
        {!isMobileWorkbench && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize response panel"
            aria-valuenow={responsePanelWidth}
            aria-valuemin={260}
            aria-valuemax={Math.round(typeof window !== 'undefined' ? window.innerWidth * 0.78 : 800)}
            aria-valuetext={`Response panel ${responsePanelWidth}px wide`}
            tabIndex={0}
            className="w-full h-1.5 md:w-1.5 md:h-full shrink-0 bg-outline-variant/20 hover:bg-primary/50 focus-visible:bg-primary/50 transition-[background-color,height,width] duration-200 cursor-row-resize md:cursor-col-resize relative outline-none"
            onMouseDown={(e) => {
              const isMobile = window.innerWidth < 768;
              panelDragRef.current = { 
                active: true, 
                startX: e.clientX, 
                startWidth: responsePanelWidth,
                startY: e.clientY,
                startHeight: responsePanelWidth
              };
              document.body.style.cursor = isMobile ? 'row-resize' : 'col-resize';
              document.body.style.userSelect = 'none';
              e.preventDefault();
              const panel = document.getElementById('response-panel');
              const onMove = (me: MouseEvent) => {
                if (isMobile) {
                  const delta = panelDragRef.current.startY - me.clientY;
                  const maxH = window.innerHeight * 0.8;
                  const newHeight = Math.max(100, Math.min(maxH, panelDragRef.current.startHeight + delta));
                  if (panel) panel.style.height = `${newHeight}px`;
                } else {
                  const delta = panelDragRef.current.startX - me.clientX;
                  const maxW = window.innerWidth * 0.78;
                  const newWidth = Math.max(260, Math.min(maxW, panelDragRef.current.startWidth + delta));
                  if (panel) panel.style.width = `${newWidth}px`;
                }
              };
              const onUp = (ue: MouseEvent) => {
                panelDragRef.current.active = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                const isMobile = window.innerWidth < 768;
                let finalVal;
                if (isMobile) {
                  const delta = panelDragRef.current.startY - ue.clientY;
                  finalVal = Math.max(100, Math.min(window.innerHeight * 0.8, panelDragRef.current.startHeight + delta));
                } else {
                  const delta = panelDragRef.current.startX - ue.clientX;
                  finalVal = Math.max(260, Math.min(window.innerWidth * 0.78, panelDragRef.current.startWidth + delta));
                }
                setResponsePanelWidth(finalVal);
                try { localStorage.setItem('grpc:ui:responsePanelWidth', String(finalVal)); } catch {}
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            onTouchStart={(e) => {
              const isMobile = window.innerWidth < 768;
              const touch = e.touches[0];
              panelDragRef.current = { 
                active: true, 
                startX: touch.clientX, 
                startWidth: responsePanelWidth,
                startY: touch.clientY,
                startHeight: responsePanelWidth
              };
              const panel = document.getElementById('response-panel');
              const onMove = (te: TouchEvent) => {
                if (isMobile) {
                  const delta = panelDragRef.current.startY - te.touches[0].clientY;
                  const maxH = window.innerHeight * 0.8;
                  const newHeight = Math.max(100, Math.min(maxH, panelDragRef.current.startHeight + delta));
                  if (panel) panel.style.height = `${newHeight}px`;
                } else {
                  const delta = panelDragRef.current.startX - te.touches[0].clientX;
                  const maxW = window.innerWidth * 0.78;
                  const newWidth = Math.max(260, Math.min(maxW, panelDragRef.current.startWidth + delta));
                  if (panel) panel.style.width = `${newWidth}px`;
                }
              };
              const onEnd = (te: TouchEvent) => {
                panelDragRef.current.active = false;
                const isMobile = window.innerWidth < 768;
                let finalVal;
                const touch = te.changedTouches[0];
                if (isMobile) {
                  const delta = panelDragRef.current.startY - touch.clientY;
                  finalVal = Math.max(100, Math.min(window.innerHeight * 0.8, panelDragRef.current.startHeight + delta));
                } else {
                  const delta = panelDragRef.current.startX - touch.clientX;
                  finalVal = Math.max(260, Math.min(window.innerWidth * 0.78, panelDragRef.current.startWidth + delta));
                }
                setResponsePanelWidth(finalVal);
                try { localStorage.setItem('grpc:ui:responsePanelWidth', String(finalVal)); } catch {}
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
              };
              window.addEventListener('touchmove', onMove, { passive: true });
              window.addEventListener('touchend', onEnd);
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 64 : 16;
              const isMobile = window.innerWidth < 768;
              if (isMobile) {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setResponsePanelWidth(w => Math.min(Math.round(window.innerHeight * 0.8), w + step));
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setResponsePanelWidth(w => Math.max(100, w - step));
                }
              } else {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setResponsePanelWidth(w => Math.min(Math.round(window.innerWidth * 0.78), w + step));
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setResponsePanelWidth(w => Math.max(260, w - step));
                }
              }
            }}
          >
            <div className="absolute inset-0 md:-left-1.5 md:-right-1.5 md:inset-y-0 -top-1.5 -bottom-1.5 md:top-0 md:bottom-0" />
          </div>
        )}

        {(!isMobileWorkbench || activeWorkbenchTab === 'response') && (
          <WorkbenchResponsePanel
            responseExpanded={responseExpanded}
            responsePanelWidth={isMobileWorkbench ? 0 : responsePanelWidth}
            isExecuting={isExecuting}
            selectedMethod={selectedMethod}
            response={response}
            responseTab={responseTab}
            setResponseTab={setResponseTab}
            copied={copied}
            setCopied={setCopied}
            grpcurlCmd={grpcurlCmd}
            curlCmd={curlCmd}
            parsedResponseBody={parsedResponseBody}
            setResponseExpanded={setResponseExpanded}
            onAbort={handleAbort}
            onNavigate={onNavigate}
            latencyThresholds={uiConfig.latencyThresholds}
          />
        )}
      </div>
    </div>
  );
}
