# gRPC Client

A web UI for testing gRPC services. Supports server reflection and `.proto` file import, with multi-workspace environments, variable interpolation, and request history.

[**Try the Live Demo**](https://whiskeyjimbo.github.io/grpc-client/)

---

## Features

- **Server reflection** — connect to any gRPC server with reflection enabled; services and methods load automatically
- **Proto import** — upload `.proto` files when reflection isn't available
- **Workspaces & environments** — organize services into workspaces and switch between environments (local, staging, prod) without re-entering config
- **Variable interpolation** — use `{{VARIABLE_NAME}}` in request payloads; variables resolve through a three-tier hierarchy (ENV → WS → OVR)
- **Metadata headers** — per-environment and per-workspace headers with sensitive-value masking
- **Request history** — every execution is logged with status, latency, and payload; replay any request with one click
- **Command preview** — see the equivalent `grpcurl` and `curl` commands for any request
- **Demo mode** — fully functional frontend with mocked data, no backend required

---

## Getting Started

### Prerequisites

- Node.js 18+
- Go 1.22+

### Run locally

```bash
# Frontend (http://localhost:3000)
npm install
npm run dev

# Backend (http://localhost:8089)
cd backend
go run ./cmd/server
```

### Demo mode (no backend)

```bash
npm run dev:demo
```

Demo mode also activates automatically when hosted on `*.github.io`, or via `?demo` in the URL.

---

## Docker

```bash
# Full stack
docker compose up --build

# Frontend only
docker build -t grpc-client .
docker run --rm -p 8080:80 grpc-client
```

---

## Configuration

### Backend environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8089` | HTTP listen port |
| `DB_PATH` | `./data/grpcclient.db` | SQLite database path |

---

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | React, TypeScript, Vite, Tailwind v4 |
| Backend | Go, `net/http`, SQLite (`modernc.org/sqlite`) |
| gRPC execution | `grpcurl` / `jhump/protoreflect` |
| Deployment | GitHub Pages (frontend), Docker (full stack) |

The Vite dev server proxies `/api/*` to the Go backend. In demo mode the frontend skips the backend entirely and uses local mock data.

---

## License

[Apache-2.0](LICENSE)
