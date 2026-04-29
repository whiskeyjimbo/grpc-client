# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A gRPC web client with a React/TypeScript frontend and a Go backend. The frontend supports a **Demo Mode** (mocked data, no backend) that activates automatically on GitHub Pages or via `npm run dev:demo`.

## Commands

### Frontend
```bash
npm install          # install dependencies
npm run dev          # dev server on :3000 with backend proxy to :8089
npm run dev:demo     # demo mode — no backend needed
npm run build        # production build → dist/
npm run lint         # TypeScript type-check (no dedicated test suite)
```

### Backend
```bash
cd backend
go run ./cmd/server              # starts on :8089, SQLite at ./data/grpcclient.db
go test ./...                    # run all tests
go test ./internal/store/...     # run a single package
```

### Docker
```bash
docker compose up --build        # full stack
docker build -t grpc-client . && docker run --rm -p 8080:80 grpc-client  # frontend only
```

### Environment variables (backend)
| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8089` | HTTP listen port |
| `DB_PATH` | `./data/grpcclient.db` | SQLite database path |

## Architecture

### Frontend (`src/`)

- **`App.tsx`** — root component; owns all global state (workspaces, environments, history, active view). All server mutations follow an optimistic-update pattern: state updates immediately, then an async API call persists; failures surface as a banner or toast.
- **`api.ts`** — every API call checks `isDemoMode()` first and delegates to `api.mock.ts` when true; otherwise it calls the Go backend at `/api/*`.
- **`types.ts`** — single source of truth for all shared types (`Workspace`, `Environment`, `HistoryItem`, `GrpcMethod`, etc.).
- **`demo-utils.ts`** — demo mode is active when: hostname ends with `.github.io`, Vite mode is `demo`, query param `?demo` is present, or `localStorage['grpc-demo-mode'] === 'true'`.
- **`themes.ts`** — multiple color palettes stored as CSS custom property maps; applied to `document.documentElement` at runtime.
- **`components/`** — screen-level components (`WorkbenchScreen`, `DefinitionsScreen`, `HistoryScreen`, `VariablesScreen`, `ConfigScreen`) plus small reusable primitives.

**Variable resolution hierarchy:** ENV-tier variables → overridden by WS-tier → overridden by OVR-tier (workspace env-specific overrides). See `src/utils.ts:resolveVariables`.

**Navigation views:** `definitions` | `workspace` | `environments` | `history` | `config` (the `ViewType` union in `types.ts`).

### Backend (`backend/`)

- **`cmd/server/main.go`** — wires together store, executor, definitions service, and optional sctest runner; starts HTTP server.
- **`internal/api/router.go`** — all REST endpoints under `/api/*`; uses standard `net/http` mux with Go 1.22 pattern matching.
- **`internal/store/`** — SQLite persistence via `modernc.org/sqlite`; WAL mode enabled by default. Stores workspaces, environments, and request history as JSON blobs.
- **`internal/execute/`** — invokes gRPC methods using `grpcurl`/`jhump/protoreflect`.
- **`internal/definitions/`** — resolves service definitions via gRPC reflection or parsed `.proto` files.
- **`internal/model/`** — shared Go types mirroring the TypeScript types in `src/types.ts`.

### Frontend ↔ Backend contract

The Vite dev server proxies `/api/*` to `http://localhost:8089` (`vite.config.ts`). The `POST /api/workspaces` and `PUT /api/workspaces/{id}` endpoints both upsert (the frontend always uses POST for create/update).

### Design system

The UI follows the "Precision Workbench" design defined in `DESIGN.md`. Key rules:
- All colors in OKLCH; no pure black/white.
- **Signal Amber** (primary) is reserved for ≤10% of any screen surface.
- Machine-readable values (method names, keys, variable names) must use the mono font (`JetBrains Mono`).
- Depth via tonal layering, not shadows. Shadows only for floating overlays.
