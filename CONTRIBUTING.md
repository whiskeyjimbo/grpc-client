# Contributing

## Development setup

**Frontend**
```bash
npm install
npm run dev        # dev server on :3000, proxies /api to :8089
npm run dev:demo   # frontend only, no backend needed
npm run lint       # TypeScript type-check
```

**Backend**
```bash
cd backend
go run ./cmd/server   # starts on :8089
go test ./...
```

## Before opening a PR

- `npm run lint` passes (TypeScript)
- `go build ./...` and `go test ./...` pass in `backend/`
- New UI behaviour tested in a browser (demo mode and live mode if relevant)

## Architecture notes

See [CLAUDE.md](CLAUDE.md) for a full overview of the codebase structure.

## Submitting changes

1. Fork the repository and create a branch from `main`.
2. Make your changes with focused, atomic commits.
3. Open a pull request — the description should explain *why*, not just *what*.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## License

By contributing you agree that your contributions will be licensed under the [Apache-2.0 License](LICENSE).
