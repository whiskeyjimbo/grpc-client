/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EnvVariable, GrpcField } from '../types.ts';

// ---------------------------------------------------------------------------
// Entity IDs
// ---------------------------------------------------------------------------

export const createEntityID = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

// ---------------------------------------------------------------------------
// Toast type (shared across App and screens)
// ---------------------------------------------------------------------------

export type Toast = {
  id: number;
  tone: 'success' | 'error';
  message: string;
  onUndo?: () => void;
};

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

// ---------------------------------------------------------------------------
// Request payload helpers
// ---------------------------------------------------------------------------

const cloneRequestPayload = (payload: unknown): Record<string, any> => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  try {
    return JSON.parse(JSON.stringify(payload)) as Record<string, any>;
  } catch {
    return { ...(payload as Record<string, any>) };
  }
};

export const sanitizeRequestDataForFields = (
  payload: unknown,
  fields: GrpcField[] | undefined,
): Record<string, any> => {
  const source = cloneRequestPayload(payload);
  if (!fields || fields.length === 0) return {};
  const sanitized: Record<string, any> = {};
  fields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(source, field.name)) return;
    const value = source[field.name];
    if (field.type === 'message' && field.fields && value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[field.name] = sanitizeRequestDataForFields(value, field.fields);
      return;
    }
    sanitized[field.name] = value;
  });
  return sanitized;
};

// ---------------------------------------------------------------------------
// Sensitive key masking
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_RE = /secret|api[_-]?key|password|passwd|token|credential|auth|authorization/i;
export const isSensitiveKey = (key: string): boolean => SENSITIVE_KEY_RE.test(key);
export const maskValue = (key: string, value: string): string =>
  isSensitiveKey(key) ? '••••••••' : value;

// ---------------------------------------------------------------------------
// Variable interpolation
// ---------------------------------------------------------------------------

export const resolveVariables = (
  text: string,
  variables: EnvVariable[],
): { text: string; missing: string[] } => {
  const missing: string[] = [];
  const resolved = text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const v = variables.find((v) => v.key === key.trim());
    if (v) return v.value;
    missing.push(key.trim());
    return match;
  });
  return { text: resolved, missing };
};

// ---------------------------------------------------------------------------
// Latency colour
// ---------------------------------------------------------------------------

export const getLatencyColor = (ms: number, thresholds?: { slow: number; critical: number }): string => {
  const slow = thresholds?.slow ?? 100;
  const critical = thresholds?.critical ?? 1000;
  if (ms < slow) return 'text-success';
  if (ms < critical) return 'text-warning';
  return 'text-error';
};

// ---------------------------------------------------------------------------
// gRPC status descriptions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleString();
};

// ---------------------------------------------------------------------------
// gRPC reflection error classification
// ---------------------------------------------------------------------------

export const classifyReflectionError = (error: unknown): string => {
  const msg = getErrorMessage(error).toLowerCase();

  if (msg.includes('tls') || msg.includes('certificate') || msg.includes('x509') || msg.includes('handshake')) {
    return 'TLS handshake failed: toggle the TLS switch and retry. The server may require plaintext, or your cert may not be trusted.';
  }
  if (
    msg.includes('connect to') ||
    msg.includes('connection refused') ||
    msg.includes('no such host') ||
    msg.includes('i/o timeout') ||
    msg.includes('dial tcp')
  ) {
    return 'Could not reach the server: check the endpoint address and that the server is running.';
  }
  if (msg.includes('deadline exceeded') || msg.includes('context deadline')) {
    return 'Connection timed out: the server is reachable but not responding. Check for firewall rules or a misconfigured port.';
  }
  if (msg.includes('unimplemented') || msg.includes('unknown service') || msg.includes('grpc.reflection')) {
    return 'Server reflection is not enabled: add grpc.reflection.Register(s) to the server, or import a .proto file instead.';
  }
  if (msg.includes('unauthenticated') || msg.includes('permission denied') || msg.includes('unauthorized')) {
    return 'Authentication required: add authorization headers in the Environments tab and retry.';
  }
  return `Reflection failed: ${getErrorMessage(error)}`;
};

// ---------------------------------------------------------------------------
// Response search
// ---------------------------------------------------------------------------

export const countMatches = (text: string, query: string): number => {
  if (!query) return 0;
  let count = 0; let pos = 0;
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  while ((pos = lower.indexOf(lowerQ, pos)) !== -1) { count++; pos += lowerQ.length; }
  return count;
};

// ---------------------------------------------------------------------------
// Request payload cleaning
// ---------------------------------------------------------------------------

export const cleanPayload = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const cleaned = cleanPayload(v);
      if (Object.keys(cleaned).length > 0) result[k] = cleaned;
    } else {
      result[k] = v;
    }
  }
  return result;
};

// ---------------------------------------------------------------------------
// gRPC status descriptions
// ---------------------------------------------------------------------------

export const GRPC_STATUS_DESCRIPTIONS: Record<number, string> = {
  0:  'Request completed successfully.',
  1:  'The client cancelled the request before the server finished.',
  2:  'An unknown error occurred, or the server returned an unrecognised status.',
  3:  'The request payload is malformed or contains invalid field values.',
  4:  'The server did not respond within the configured deadline.',
  5:  'The requested resource was not found.',
  6:  'A resource with this identifier already exists.',
  7:  'The caller does not have permission to execute this operation.',
  8:  'A quota or rate limit was exceeded. Retry after backing off.',
  9:  'The system is not in a state that allows this operation.',
  10: 'The operation was aborted, typically due to a concurrency conflict.',
  11: 'The operation was attempted outside the valid range for this resource.',
  12: 'This method is not implemented or supported by the server.',
  13: 'An internal server error occurred. Check server logs for details.',
  14: 'The server is temporarily unavailable. Retry with exponential backoff.',
  15: 'Unrecoverable data loss or corruption detected.',
  16: 'Credentials are missing, expired, or invalid.',
};
