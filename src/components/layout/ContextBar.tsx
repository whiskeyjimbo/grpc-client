/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import { Layers, Tag, Plus, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Workspace, Environment } from '../../types.ts';
import { Tooltip } from './Tooltip.tsx';
import { CustomSelect } from './CustomSelect.tsx';

const EntityOverflow = memo(function EntityOverflow({
  entity,
  containerRef,
  isOpen,
  onToggle,
  canDelete,
  onDelete,
  onRename,
  color,
}: {
  entity: 'workspace' | 'environment';
  containerRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  onToggle: () => void;
  canDelete: boolean;
  onDelete: () => void;
  onRename: () => void;
  color: string;
}) {
  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={onToggle}
        className="h-11 w-11 flex items-center justify-center rounded text-outline/40 hover:text-on-surface hover:bg-surface-container-high/50 transition-colors"
        aria-label={`${entity} actions`}
        aria-expanded={isOpen}
        title={`${entity === 'workspace' ? 'Workspace' : 'Environment'} actions`}
      >
        <MoreHorizontal size={14} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 mt-1.5 z-50 bg-surface-container-highest border border-outline-variant/30 rounded shadow-xl overflow-hidden min-w-[120px]"
          >
            <button
              onClick={onRename}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors text-left"
            >
              <Pencil size={11} className={color} />
              Rename
            </button>
            <button
              onClick={onDelete}
              disabled={!canDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-on-surface-variant hover:text-error hover:bg-error/5 transition-colors text-left disabled:opacity-30 disabled:cursor-not-allowed"
              title={!canDelete ? `Cannot delete the last ${entity}` : undefined}
            >
              <Trash2 size={11} />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export function ContextBar({
  activeWorkspace,
  activeEnvironment,
  workspaces,
  environments,
  onWorkspaceChange,
  onEnvironmentChange,
  onCreateWorkspace,
  onDeleteWorkspace,
  onCreateEnvironment,
  onDeleteEnvironment,
  canDeleteWorkspace,
  canDeleteEnvironment,
  onRenameWorkspace,
  onRenameEnvironment,
}: {
  activeWorkspace: Workspace,
  activeEnvironment: Environment,
  workspaces: Workspace[],
  environments: Environment[],
  onWorkspaceChange: (id: string) => void,
  onEnvironmentChange: (id: string) => void,
  onCreateWorkspace: () => void,
  onDeleteWorkspace: () => void,
  onCreateEnvironment: () => void,
  onDeleteEnvironment: () => void,
  canDeleteWorkspace: boolean,
  canDeleteEnvironment: boolean,
  onRenameWorkspace: (id: string, name: string) => void,
  onRenameEnvironment: (id: string, name: string) => void,
}) {
  const [renamingEntity, setRenamingEntity] = useState<'workspace' | 'environment' | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [overflowOpen, setOverflowOpen] = useState<'workspace' | 'environment' | null>(null);
  const wsOverflowRef = useRef<HTMLDivElement>(null);
  const envOverflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const handle = (e: MouseEvent) => {
      const ref = overflowOpen === 'workspace' ? wsOverflowRef : envOverflowRef;
      if (!ref.current?.contains(e.target as Node)) setOverflowOpen(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [overflowOpen]);

  const startRename = (entity: 'workspace' | 'environment') => {
    setOverflowOpen(null);
    setRenamingEntity(entity);
    setRenameValue(entity === 'workspace' ? activeWorkspace.name : activeEnvironment.name);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && renamingEntity === 'workspace') onRenameWorkspace(activeWorkspace.id, trimmed);
    if (trimmed && renamingEntity === 'environment') onRenameEnvironment(activeEnvironment.id, trimmed);
    setRenamingEntity(null);
  };

  const cancelRename = () => setRenamingEntity(null);

  return (
    <div className="min-h-[36px] md:min-h-[40px] py-1.5 md:py-0 border-b border-outline-variant/20 bg-background flex flex-wrap items-center px-3 md:px-4 gap-x-4 md:gap-x-10 gap-y-1 shrink-0">
      <div className="group/ws flex items-center gap-1.5 min-w-0">
        <Tooltip content="Active workspace. WS-tier variables override ENV defaults." side="bottom">
          <span className="type-eyebrow text-outline/60 cursor-default leading-none hidden xs:inline">Workspace</span>
          <Layers size={10} className="xs:hidden text-outline/50" />
        </Tooltip>
        {renamingEntity === 'workspace' ? (
          <input
            autoFocus
            className="bg-surface-container border border-primary rounded px-2 py-1 text-[11px] font-bold text-primary outline-none w-32"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
            }}
            aria-label="Rename workspace"
          />
        ) : (
          <CustomSelect
            value={activeWorkspace.id}
            options={workspaces}
            onChange={onWorkspaceChange}
            colorClass="text-primary"
            ariaLabel="Active workspace"
          />
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/ws:opacity-100 group-focus-within/ws:opacity-100 transition-opacity duration-150 shrink-0">
          <EntityOverflow
            entity="workspace"
            containerRef={wsOverflowRef}
            isOpen={overflowOpen === 'workspace'}
            onToggle={() => setOverflowOpen(overflowOpen === 'workspace' ? null : 'workspace')}
            canDelete={canDeleteWorkspace}
            onDelete={onDeleteWorkspace}
            onRename={() => startRename('workspace')}
            color="text-primary"
          />
        </div>
        <button onClick={onCreateWorkspace} className="h-11 w-11 flex items-center justify-center rounded text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors shrink-0 outline-none" aria-label="New workspace" title="New workspace">
          <Plus size={11} />
        </button>
      </div>

      <div className="group/env flex items-center gap-1.5 min-w-0">
        <Tooltip content="Active environment. ENV-tier variables are the shared baseline; WS and OVR tiers override them." side="bottom">
          <span className="type-eyebrow text-outline/60 cursor-default leading-none hidden xs:inline">Environment</span>
          <Tag size={10} className="xs:hidden text-outline/50" />
        </Tooltip>
        {renamingEntity === 'environment' ? (
          <input
            autoFocus
            className="bg-surface-container border border-secondary rounded px-2 py-1 text-[11px] font-bold text-secondary outline-none w-32"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
            }}
            aria-label="Rename environment"
          />
        ) : (
          <CustomSelect
            value={activeEnvironment.id}
            options={environments}
            onChange={onEnvironmentChange}
            colorClass="text-secondary"
            ariaLabel="Active environment"
          />
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/env:opacity-100 group-focus-within/env:opacity-100 transition-opacity duration-150 shrink-0">
          <EntityOverflow
            entity="environment"
            containerRef={envOverflowRef}
            isOpen={overflowOpen === 'environment'}
            onToggle={() => setOverflowOpen(overflowOpen === 'environment' ? null : 'environment')}
            canDelete={canDeleteEnvironment}
            onDelete={onDeleteEnvironment}
            onRename={() => startRename('environment')}
            color="text-secondary"
          />
        </div>
        <button onClick={onCreateEnvironment} className="h-11 w-11 flex items-center justify-center rounded text-secondary/50 hover:text-secondary hover:bg-secondary/10 transition-colors shrink-0 outline-none" aria-label="New environment" title="New environment">
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}
