/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  // Automatically enable demo mode if hosted on GitHub Pages or running in demo mode
  const isGithubPages = window.location.hostname.endsWith('.github.io');
  const isViteDemo = (import.meta as any).env?.MODE === 'demo';
  return isGithubPages || isViteDemo || (
    new URLSearchParams(window.location.search).has('demo') ||
    localStorage.getItem('grpc-demo-mode') === 'true'
  );
}

export function isForcedDemoMode(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

export function setDemoMode(active: boolean) {
  if (active) {
    localStorage.setItem('grpc-demo-mode', 'true');
  } else {
    localStorage.removeItem('grpc-demo-mode');
  }
}
