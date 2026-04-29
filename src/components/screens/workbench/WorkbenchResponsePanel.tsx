/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, animate } from 'motion/react';
import { Copy, Maximize2, Minimize2, Check, RefreshCw, X, Tag, Terminal as TerminalIcon, Search } from 'lucide-react';
import type { GrpcMethod } from '../../../types.ts';
import { MonoKeyValue, JsonValue } from '../../ui/index.ts';
import { GRPC_STATUS_DESCRIPTIONS, getLatencyColor, countMatches } from '../../../lib/utils.ts';

function ExecutionTimer({ isExecuting }: { isExecuting: boolean }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!isExecuting) { setElapsedMs(0); return; }
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [isExecuting]);
  return <span className="text-xs font-mono tabular-nums text-on-surface-variant/60">{(elapsedMs / 1000).toFixed(1)}s</span>;
}

function AnimatedLatency({ response, thresholds }: { response: { timeMs: number }, thresholds?: { slow: number; critical: number } }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!response || !nodeRef.current) return;
    const target = response.timeMs;
    if (target === 0) { nodeRef.current.textContent = '0ms'; return; }
    const duration = Math.min(0.7, (target * 1.5) / 1000);
    const controls = animate(0, target, {
      duration, ease: "easeOut",
      onUpdate: (value) => { if (nodeRef.current) nodeRef.current.textContent = `${Math.round(value)}ms`; }
    });
    return () => controls.stop();
  }, [response]);
  return <span ref={nodeRef} className={`text-xs font-mono tabular-nums ${getLatencyColor(response?.timeMs || 0, thresholds)}`}>{response?.timeMs ?? 0}ms</span>;
}

/** Renders text with all occurrences of `query` highlighted. */
function HighlightedText({ text, query, matchIndex }: { text: string; query: string; matchIndex: number }) {
  const parts = useMemo(() => {
    if (!query) return [{ text, match: false }];
    const segments: { text: string; match: boolean; idx: number }[] = [];
    const lower = text.toLowerCase();
    const lowerQ = query.toLowerCase();
    let cursor = 0; let matchCount = 0;
    while (cursor < text.length) {
      const found = lower.indexOf(lowerQ, cursor);
      if (found === -1) { segments.push({ text: text.slice(cursor), match: false, idx: -1 }); break; }
      if (found > cursor) segments.push({ text: text.slice(cursor, found), match: false, idx: -1 });
      segments.push({ text: text.slice(found, found + query.length), match: true, idx: matchCount++ });
      cursor = found + query.length;
    }
    return segments;
  }, [text, query]);

  return (
    <pre className="font-mono text-xs text-on-surface leading-relaxed whitespace-pre-wrap break-all">
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            data-match-idx={(p as any).idx}
            className={(p as any).idx === matchIndex
              ? 'bg-primary text-on-primary rounded-sm'
              : 'bg-primary/25 text-on-surface rounded-sm'}
          >{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </pre>
  );
}


interface WorkbenchResponsePanelProps {
  responseExpanded: boolean;
  responsePanelWidth: number;
  isExecuting: boolean;
  selectedMethod: GrpcMethod | null;
  response: any;
  responseTab: 'response' | 'grpcurl' | 'curl';
  setResponseTab: (t: 'response' | 'grpcurl' | 'curl') => void;
  copied: boolean;
  setCopied: (c: boolean) => void;
  grpcurlCmd: string;
  curlCmd: string;
  parsedResponseBody: any;
  setResponseExpanded: (e: boolean | ((prev: boolean) => boolean)) => void;
  onAbort: () => void;
  onNavigate?: (v: 'workbench' | 'history' | 'environments' | 'definitions' | 'config') => void;
  latencyThresholds?: { slow: number; critical: number };
}

export const WorkbenchResponsePanel = memo(function WorkbenchResponsePanel({
  responseExpanded, responsePanelWidth, isExecuting, selectedMethod,
  response, responseTab, setResponseTab, copied, setCopied,
  grpcurlCmd, curlCmd, parsedResponseBody, setResponseExpanded, onAbort, onNavigate, latencyThresholds
}: WorkbenchResponsePanelProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Text to search against depending on active tab
  const searchableText = useMemo(() => {
    if (responseTab === 'grpcurl') return grpcurlCmd;
    if (responseTab === 'curl') return curlCmd;
    if (response) return response.body ?? JSON.stringify(parsedResponseBody ?? '', null, 2);
    return '';
  }, [responseTab, grpcurlCmd, curlCmd, response, parsedResponseBody]);

  const matchCount = useMemo(() => countMatches(searchableText, searchQuery), [searchableText, searchQuery]);
  const clampedIndex = matchCount > 0 ? matchIndex % matchCount : 0;

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setMatchIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 30);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setMatchIndex(0);
  }, []);

  const stepMatch = useCallback((dir: 1 | -1) => {
    setMatchIndex(prev => {
      if (matchCount === 0) return 0;
      return (prev + dir + matchCount) % matchCount;
    });
  }, [matchCount]);

  // Scroll active match into view
  useEffect(() => {
    if (!searchOpen || !searchQuery) return;
    const el = panelRef.current?.querySelector(`[data-match-idx="${clampedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [clampedIndex, searchOpen, searchQuery]);

  // Global keydown: `/` opens search; tab shortcuts
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === '1') { e.preventDefault(); setResponseTab('response'); }
        else if (e.key === '2') { e.preventDefault(); setResponseTab('grpcurl'); }
        else if (e.key === '3') { e.preventDefault(); setResponseTab('curl'); }
      }
      // `/` opens search unless focus is in an input/textarea
      if (e.key === '/' && !searchOpen) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          openSearch();
        }
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [setResponseTab, searchOpen, openSearch]);

  const noHaveResponse = !response && !isExecuting;

  return (
    <motion.section
      ref={panelRef}
      id="response-panel"
      aria-label="Response details"
      className="flex flex-col bg-background"
      animate={
        window.innerWidth < 768
          ? responseExpanded 
            ? { height: '100%', width: '100%', flex: 1 } 
            : { height: `${responsePanelWidth}px`, width: '100%', flex: '0 0 auto' }
          : responseExpanded 
            ? { width: 'auto', flex: 1, height: '100%' } 
            : { width: `${responsePanelWidth}px`, flex: '0 0 auto', height: '100%' }
      }
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{ minWidth: window.innerWidth < 768 ? '100%' : '260px' }}
    >
      {/* Execution scan-line */}
      <div className="h-0.5 relative overflow-hidden bg-surface-container-low shrink-0">
        <AnimatePresence>
          {isExecuting && (
            <motion.div
              key="scan"
              className="absolute inset-y-0 w-2/5 bg-primary"
              initial={{ x: '-100%' }}
              animate={{ x: '350%' }}
              exit={{ opacity: 0, transition: { duration: 0.2, repeat: 0, ease: 'easeOut' } }}
              transition={{ duration: 1.6, repeat: Infinity, ease: [0.16, 1, 0.3, 1], repeatType: 'loop' as const }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Tab strip */}
      <div className="h-11 border-b border-outline-variant flex items-center bg-surface-container-low shrink-0">
        <div className="flex items-center h-full flex-1 min-w-0">
          <div className="flex h-full shrink" role="tablist" aria-label="Response Panels">
            {(['response', 'grpcurl', 'curl'] as const).map((tab, idx, arr) => (
              <button
                key={tab}
                role="tab"
                aria-selected={responseTab === tab}
                aria-controls={`${tab}-panel`}
                tabIndex={responseTab === tab ? 0 : -1}
                onClick={() => setResponseTab(tab)}
                onKeyDown={(e) => {
                  let nextIdx = idx;
                  if (e.key === 'ArrowRight') nextIdx = (idx + 1) % arr.length;
                  else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + arr.length) % arr.length;
                  if (nextIdx !== idx) {
                    e.preventDefault();
                    setResponseTab(arr[nextIdx]);
                    const btns = e.currentTarget.parentElement?.querySelectorAll('button[role="tab"]');
                    (btns?.[nextIdx] as HTMLButtonElement)?.focus();
                  }
                }}
                className={`h-full px-4 type-btn relative transition-colors text-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset group ${
                  responseTab === tab ? 'text-on-surface font-medium' : 'text-on-surface-variant/60 hover:text-on-surface'
                }`}
              >
                {tab === 'response' ? 'Response' : tab === 'grpcurl' ? 'grpcurl' : 'cURL'}
                <kbd aria-hidden="true" className="absolute top-1 right-1 text-[10px] opacity-0 group-hover:opacity-40 transition-opacity font-mono pointer-events-none">
                  {idx + 1}
                </kbd>
                {responseTab === tab && (
                  <motion.div
                    layoutId="response-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
              </button>
            ))}
          </div>
          {isExecuting && responseTab === 'response' && (
            <div className="flex items-center gap-2 ml-3">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
              <ExecutionTimer isExecuting={isExecuting} />
              <button onClick={onAbort} className="hover:bg-error/10 text-error transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-error" title="Cancel Request" aria-label="Cancel Request">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          {response && !isExecuting && responseTab === 'response' && (
            <div className="flex items-center gap-2 ml-3">
              <span
                className={`text-xs px-2 py-0.5 rounded cursor-help font-medium ${response.status === 0 ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}
                title={GRPC_STATUS_DESCRIPTIONS[response.status] ?? `gRPC status code ${response.status}`}
              >
                {response.statusText} ({response.status})
              </span>
              <AnimatedLatency response={response} thresholds={latencyThresholds} />
            </div>
          )}
        </div>
        <div className="px-2 flex items-center gap-1 shrink-0">
          {/* Search toggle */}
          {(response || responseTab !== 'response') && (
            <button
              onClick={searchOpen ? closeSearch : openSearch}
              className={`p-2.5 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary ${searchOpen ? 'text-primary bg-primary/10' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
              title="Search response (/ )"
              aria-label="Search response"
              aria-pressed={searchOpen}
            >
              <Search size={12} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={() => setResponseExpanded(e => !e)}
            className="p-2.5 rounded text-on-surface-variant/60 hover:text-on-surface transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={responseExpanded ? 'Restore panel width' : 'Expand response panel'}
            aria-label={responseExpanded ? 'Restore panel width' : 'Expand response panel'}
          >
            {responseExpanded ? <Minimize2 size={12} aria-hidden="true" /> : <Maximize2 size={12} aria-hidden="true" />}
          </button>
          <button
            onClick={() => {
              let text = '';
              if (responseTab === 'response' && response) text = response.body;
              else if (responseTab === 'grpcurl') text = grpcurlCmd;
              else if (responseTab === 'curl') text = curlCmd;
              if (text) {
                void navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }
            }}
            disabled={responseTab === 'response' && !response}
            className={`p-2.5 rounded transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary ${copied ? 'text-success' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
            title={copied ? 'Copied!' : responseTab === 'response' ? 'Copy response body' : `Copy ${responseTab} command`}
            aria-label={responseTab === 'response' ? 'Copy response body' : `Copy ${responseTab} command`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="check" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }} className="block">
                  <Check size={12} aria-hidden="true" />
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }} className="block">
                  <Copy size={12} aria-hidden="true" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            key="searchbar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden shrink-0"
          >
            <div className={`flex items-center gap-2 px-3 py-2 border-b ${matchCount === 0 && searchQuery ? 'border-error/30 bg-error/5' : 'border-outline-variant/30 bg-surface-container-low'}`}>
              <Search size={12} className={matchCount === 0 && searchQuery ? 'text-error/60' : 'text-on-surface-variant/50'} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setMatchIndex(0); }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { closeSearch(); }
                  else if (e.key === 'Enter') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1); }
                  else if (e.key === 'n') { e.preventDefault(); stepMatch(1); }
                  else if (e.key === 'N') { e.preventDefault(); stepMatch(-1); }
                }}
                placeholder="Search…"
                className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-on-surface-variant/40 text-on-surface"
                aria-label="Search response content"
              />
              {searchQuery && (
                <span className={`text-xs font-mono tabular-nums shrink-0 ${matchCount === 0 ? 'text-error/70' : 'text-on-surface-variant'}`}>
                  {matchCount === 0 ? 'no matches' : `${clampedIndex + 1} / ${matchCount}`}
                </span>
              )}
              {searchQuery && matchCount > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => stepMatch(-1)} className="p-1 rounded hover:bg-surface-container-high text-outline-variant hover:text-on-surface transition-colors" title="Previous match (Shift+Enter)" aria-label="Previous match">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button onClick={() => stepMatch(1)} className="p-1 rounded hover:bg-surface-container-high text-outline-variant hover:text-on-surface transition-colors" title="Next match (Enter)" aria-label="Next match">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              )}
              <button onClick={closeSearch} className="p-1 rounded text-on-surface-variant/60 hover:text-on-surface transition-colors shrink-0" aria-label="Close search">
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence initial={false}>
        {responseTab !== 'response' ? (
          <motion.div key="cmd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="absolute inset-0 overflow-y-auto p-4 custom-scrollbar" role="tabpanel" id={`${responseTab}-panel`} aria-labelledby={`${responseTab}-tab`}>
            {searchOpen && searchQuery ? (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-4 min-h-[120px] shadow-sm">
                <HighlightedText text={responseTab === 'grpcurl' ? grpcurlCmd : curlCmd} query={searchQuery} matchIndex={clampedIndex} />
              </div>
            ) : (
              <pre className="font-mono text-xs text-on-surface leading-relaxed bg-surface-container-lowest border border-outline-variant/30 rounded p-4 whitespace-pre-wrap break-all min-h-[120px] shadow-sm">
                {responseTab === 'grpcurl' ? grpcurlCmd : curlCmd}
              </pre>
            )}
            <p className="text-xs text-on-surface-variant/60 mt-3 italic">
              Updates as you edit. Copy and paste into your terminal.
            </p>
          </motion.div>
        ) : noHaveResponse ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center scale-95">
            <TerminalIcon size={48} className="text-on-surface-variant/30 mb-6" aria-hidden="true" />
            <h3 className="text-on-surface font-bold text-sm mb-2 uppercase tracking-wide">No Response Yet</h3>
            <p className="text-sm text-on-surface-variant/60 max-w-[180px] leading-relaxed mb-3">
              Select a method and press ⌘↵ to execute.
            </p>
            <div className="flex flex-col items-start gap-2.5 text-xs text-outline-variant font-mono mt-2" aria-label="Keyboard shortcuts">
              <div className="flex items-center gap-3">
                <kbd aria-hidden="true" className="w-8 text-center bg-surface-container px-1 py-1 rounded border border-outline-variant text-on-surface shadow-sm font-medium text-xs">⌘↵</kbd>
                <span>Execute request</span>
              </div>
              <div className="flex items-center gap-3">
                <kbd aria-hidden="true" className="w-8 text-center bg-surface-container px-1 py-0.5 rounded border border-outline-variant text-on-surface shadow-sm font-medium">⌘K</kbd>
                <span>Search methods</span>
              </div>
              <div className="flex items-center gap-3">
                <kbd aria-hidden="true" className="w-8 text-center bg-surface-container px-1 py-0.5 rounded border border-outline-variant text-on-surface shadow-sm font-medium">/</kbd>
                <span>Search response</span>
              </div>
            </div>
          </motion.div>
        ) : isExecuting ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} className="mb-4">
              <RefreshCw size={32} className="text-primary" aria-hidden="true" />
            </motion.div>
            <h3 className="text-on-surface font-bold text-sm mb-1 uppercase tracking-wide">Executing...</h3>
            <p className="text-xs text-on-surface-variant/60 font-mono italic">Waiting for upstream response</p>
          </motion.div>
        ) : (
          <motion.div
            key={response.timeMs + response.status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            role="tabpanel"
            id="response-panel"
            aria-labelledby="response-tab"
          >
            {response.messages ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/10">
                  <div className={`w-1.5 h-1.5 rounded-full bg-primary ${isExecuting ? 'animate-pulse' : ''}`} />
                  <span className="type-label text-primary">Live Stream Events</span>
                </div>
                {response.messages.map((msg: any, i: number) => (
                  <div key={i} className="bg-surface-container border border-outline-variant rounded-lg p-4 font-mono text-xs relative overflow-hidden">
                    <div className="absolute right-3 top-3 text-xs font-mono text-outline-variant tabular-nums">{new Date(msg.ts).toLocaleTimeString()}</div>
                    <JsonValue value={msg} depth={0} isLast={true} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {response.status !== 0 && (
                  <div className="border border-error bg-error-container rounded p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-error/20 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={16} className="text-on-error-container" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-bold text-sm text-on-error-container">{response.statusText}</span>
                        <span className="text-xs font-mono text-on-error-container/70">code {response.status}</span>
                      </div>
                      <p className="text-xs text-on-error-container leading-snug">
                        {GRPC_STATUS_DESCRIPTIONS[response.status] ?? `gRPC status code ${response.status}`}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {response.status === 14 && (
                          <button onClick={() => onNavigate?.('config')} className="text-xs font-bold uppercase tracking-widest bg-on-error-container/10 hover:bg-on-error-container/20 px-2.5 py-1.5 rounded transition-colors text-on-error-container border border-on-error-container/10">
                            Check Network Config
                          </button>
                        )}
                        {response.status === 12 && (
                          <button onClick={() => onNavigate?.('definitions')} className="text-xs font-bold uppercase tracking-widest bg-on-error-container/10 hover:bg-on-error-container/20 px-2.5 py-1.5 rounded transition-colors text-on-error-container border border-on-error-container/10">
                            Verify Proto/Reflection
                          </button>
                        )}
                        {response.status === 16 && (
                          <button onClick={() => onNavigate?.('environments')} className="text-xs font-bold uppercase tracking-widest bg-on-error-container/10 hover:bg-on-error-container/20 px-2.5 py-1.5 rounded transition-colors text-on-error-container border border-on-error-container/10">
                            Check Auth Headers
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="font-mono text-xs text-on-surface leading-loose p-4 rounded border shadow-inner overflow-x-auto bg-surface-container border-outline-variant">
                  {searchOpen && searchQuery ? (
                    <HighlightedText text={searchableText} query={searchQuery} matchIndex={clampedIndex} />
                  ) : (
                    <JsonValue value={parsedResponseBody} depth={0} isLast={true} />
                  )}
                </div>
              </>
            )}
            {Object.keys(response.headers).length > 0 && (
              <div className="space-y-2 pt-6">
                <h4 className="text-xs font-bold text-on-surface-variant/60 flex items-center gap-2">
                  <Tag size={12} aria-hidden="true" /> Response Trailers
                </h4>
                <div className="bg-surface-container border border-outline-variant rounded p-4">
                  {Object.entries(response.headers).map(([k, v]) => (
                    <MonoKeyValue key={k} label={k} value={v} valueColorClass="text-tertiary" />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
});
