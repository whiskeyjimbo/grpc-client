/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import type { GrpcMethod, EnvVariable, MetadataHeader } from '../../../types.ts';
import { sanitizeRequestDataForFields } from '../../../lib/utils.ts';

interface WorkspaceContextType {
  requestData: Record<string, any>;
  updateRequestData: (path: string, value: any) => void;
  setRequestData: (data: Record<string, any>) => void;
  
  response: any;
  setResponse: (r: any) => void;
  isExecuting: boolean;
  setIsExecuting: (e: boolean) => void;
  
  selectedMethod: GrpcMethod | null;
  setSelectedMethod: (m: GrpcMethod | null) => void;

  varOverrides: EnvVariable[] | null;
  setVarOverrides: (v: EnvVariable[] | null) => void;
  headerOverrides: MetadataHeader[] | null;
  setHeaderOverrides: (h: MetadataHeader[] | null) => void;
  contextOpen: boolean;
  setContextOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ 
  children,
  workspaceId,
}: { 
  children: React.ReactNode;
  workspaceId: string;
}) {
  const [requestData, _setRequestData] = useState<Record<string, any>>({});
  const [response, setResponse] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<GrpcMethod | null>(null);

  const [varOverrides, setVarOverrides] = useState<EnvVariable[] | null>(null);
  const [headerOverrides, setHeaderOverrides] = useState<MetadataHeader[] | null>(null);
  const [contextOpen, setContextOpen] = useState(() => {
    try { return localStorage.getItem('grpc:ui:contextOpen') === 'true'; } catch { return false; }
  });

  const setRequestData = useCallback((data: Record<string, any>) => {
    _setRequestData(data);
  }, []);

  const updateRequestData = useCallback((path: string, value: any) => {
    _setRequestData(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      const dangerous = new Set(['__proto__', 'constructor', 'prototype']);
      if (keys.some(k => dangerous.has(k))) return prev;
      let current = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const hasOwn = Object.prototype.hasOwnProperty.call(current, key);
        const existing = hasOwn ? current[key] : undefined;
        const isPlainObject =
          typeof existing === 'object' &&
          existing !== null &&
          !Array.isArray(existing);

        current[key] = isPlainObject ? { ...existing } : {};
        current = current[key];
      }
      current[keys[keys.length - 1]] = value;

      if (selectedMethod) {
        try {
          localStorage.setItem(`grpc:req:${workspaceId}:${selectedMethod.id}`, JSON.stringify(next));
        } catch { /* storage quota exceeded */ }
      }

      return next;
    });
  }, [selectedMethod, workspaceId]);

  const value = useMemo(() => ({
    requestData,
    updateRequestData,
    setRequestData,
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
    setContextOpen,
  }), [requestData, updateRequestData, setRequestData, response, isExecuting, selectedMethod, varOverrides, headerOverrides, contextOpen]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
