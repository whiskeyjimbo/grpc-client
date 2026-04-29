/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ViewType = 'definitions' | 'workspace' | 'environments' | 'history' | 'config';

export interface UIConfig {
  latencyThresholds: {
    slow: number;
    critical: number;
  };
  historyRetentionCount: number;
}

export interface GrpcField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'message';
  required?: boolean;
  repeated?: boolean;
  rules?: string[];
  enumValues?: string[];
  fields?: GrpcField[];
}

export interface GrpcMethod {
  id: string;
  name: string;
  fullName?: string;
  type: 'unary' | 'server_streaming' | 'client_streaming' | 'bidirectional';
  requestType: string;
  responseType: string;
  requestFields?: GrpcField[];
}

export interface GrpcService {
  id: string;
  name: string;
  methods: GrpcMethod[];
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status: 'OK' | 'INTERNAL' | 'NOT_FOUND' | 'UNAUTHENTICATED' | 'CANCELED';
  latency: string;
  requestPayload: any;
  responsePayload: any;
  responseHeaders?: Record<string, string>;
  requestHeaders?: MetadataHeader[];
  environmentId?: string;
  environmentName: string;
  workspaceId?: string;
  workspaceName: string;
  resolvedVariables?: EnvVariable[];
}

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvVariable[];
  headers: MetadataHeader[];
}

export interface ConnectionPolicy {
  enableTls: boolean;
  insecureTls?: boolean;
  timeoutMs: number;
  maxReceiveSizeMb: number;
}

export interface Workspace {
  id: string;
  name: string;
  variables: EnvVariable[]; // Global workspace variables (overrides env)
  headers: MetadataHeader[]; // Global workspace headers (overrides env)
  services: GrpcService[]; // Workspace-specific definitions
  connectionPolicy?: ConnectionPolicy;
  uiConfig?: UIConfig;
  // Environment-specific overrides for this workspace
  envOverrides?: Record<string, {
    variables?: EnvVariable[];
    headers?: MetadataHeader[];
    connectionPolicy?: ConnectionPolicy;
    uiConfig?: UIConfig;
  }>;
}

export interface MetadataHeader {
  id: string;
  key: string;
  value: string;
}
