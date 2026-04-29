/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, GrpcMethod, GrpcService, HistoryItem, Workspace } from '../types';
import { isDemoMode } from '../lib/demoUtils';
import * as mockApi from './mock';

export { isDemoMode, isForcedDemoMode, setDemoMode } from '../lib/demoUtils';

export interface BootstrapResponse {
  workspaces: Workspace[];
  environments: Environment[];
  history: HistoryItem[];
}

export interface ExecuteResponse {
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
  timeMs: number;
  messages?: any[];
}

export interface DefinitionsResponse {
  services: GrpcService[];
}

async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await safeErrorText(response);
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload.error === 'string') {
      return payload.error;
    }
    return JSON.stringify(payload);
  } catch {
    return response.statusText;
  }
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  if (isDemoMode()) return mockApi.fetchBootstrap();
  return requestJSON<BootstrapResponse>('/api/bootstrap');
}

export async function upsertWorkspace(workspace: Workspace): Promise<Workspace> {
  if (isDemoMode()) return mockApi.upsertWorkspace(workspace);
  return requestJSON<Workspace>('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify(workspace),
  });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  if (isDemoMode()) return mockApi.deleteWorkspace(workspaceId);
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await safeErrorText(response);
    throw new Error(errorText || `Delete workspace failed with status ${response.status}`);
  }
}

export async function upsertEnvironment(environment: Environment): Promise<Environment> {
  if (isDemoMode()) return mockApi.upsertEnvironment(environment);
  return requestJSON<Environment>('/api/environments', {
    method: 'POST',
    body: JSON.stringify(environment),
  });
}

export async function deleteEnvironment(environmentId: string): Promise<void> {
  if (isDemoMode()) return mockApi.deleteEnvironment(environmentId);
  const response = await fetch(`/api/environments/${encodeURIComponent(environmentId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await safeErrorText(response);
    throw new Error(errorText || `Delete environment failed with status ${response.status}`);
  }
}

export async function deleteHistory(id: string): Promise<void> {
  if (isDemoMode()) return mockApi.deleteHistory(id);
  const response = await fetch(`/api/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await safeErrorText(response);
    throw new Error(errorText || `Delete history failed with status ${response.status}`);
  }
}

export async function deleteHistoryBulk(ids: string[]): Promise<void> {
  if (isDemoMode()) return mockApi.deleteHistoryBulk(ids);
  const response = await fetch('/api/history', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const errorText = await safeErrorText(response);
    throw new Error(errorText || `Bulk delete history failed with status ${response.status}`);
  }
}

export async function appendHistory(item: HistoryItem): Promise<HistoryItem> {
  if (isDemoMode()) return mockApi.appendHistory(item);
  return requestJSON<HistoryItem>('/api/history', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function executeRequest(input: {
  method: GrpcMethod;
  requestPayload: any;
  endpoint: string;
  tls: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ExecuteResponse> {
  if (isDemoMode()) return mockApi.executeRequest(input);

  const { signal, ...body } = input;
  return requestJSON<ExecuteResponse>('/api/execute', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

export async function reflectDefinitions(input: {
  target: string;
  tls: boolean;
  authority?: string;
}): Promise<DefinitionsResponse> {
  if (isDemoMode()) return mockApi.reflectDefinitions(input);
  return requestJSON<DefinitionsResponse>('/api/definitions/reflect', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function importProtoFiles(files: File[]): Promise<DefinitionsResponse> {
  if (isDemoMode()) return mockApi.importProtoFiles(files);
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file, file.name);
  });

  const response = await fetch('/api/definitions/proto', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await safeErrorText(response);
    throw new Error(errorText || `Proto import failed with status ${response.status}`);
  }

  return response.json() as Promise<DefinitionsResponse>;
}
