// Package store provides SQLite-backed persistence for grpc-client backend state.
package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/model"
)

const (
	defaultHistoryLimit = 500
)

var (
	ErrLastWorkspace       = errors.New("cannot delete the last workspace")
	ErrWorkspaceNotFound   = errors.New("workspace not found")
	ErrLastEnvironment     = errors.New("cannot delete the last environment")
	ErrEnvironmentNotFound = errors.New("environment not found")
)

// StoreOption configures a Store.
type StoreOption func(*storeConfig)

type storeConfig struct {
	walMode       bool
	foreignKeys   bool
	busyTimeoutMS int
}

func defaultStoreConfig() storeConfig {
	return storeConfig{walMode: true, foreignKeys: true, busyTimeoutMS: 5000}
}

// WithWALMode enables or disables SQLite WAL journal mode (default: enabled).
func WithWALMode(enabled bool) StoreOption {
	return func(c *storeConfig) { c.walMode = enabled }
}

// WithForeignKeys enables or disables SQLite foreign-key enforcement (default: enabled).
func WithForeignKeys(enabled bool) StoreOption {
	return func(c *storeConfig) { c.foreignKeys = enabled }
}

// WithBusyTimeout sets the SQLite busy timeout in milliseconds (default: 5000).
func WithBusyTimeout(ms int) StoreOption {
	return func(c *storeConfig) { c.busyTimeoutMS = ms }
}

// Store persists workspaces, environments, and history in SQLite.
type Store struct {
	db *sql.DB
}

// Open initializes a SQLite store at dbPath.
func Open(dbPath string, opts ...StoreOption) (*Store, error) {
	if strings.TrimSpace(dbPath) == "" {
		return nil, errors.New("dbPath is required")
	}

	cfg := defaultStoreConfig()
	for _, opt := range opts {
		opt(&cfg)
	}

	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		return nil, fmt.Errorf("resolve DB path: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		return nil, fmt.Errorf("create DB directory: %w", err)
	}

	db, err := sql.Open("sqlite", absPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}

	if cfg.walMode {
		if _, err := db.Exec("PRAGMA journal_mode = WAL;"); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("configure sqlite WAL mode: %w", err)
		}
	}
	if cfg.foreignKeys {
		if _, err := db.Exec("PRAGMA foreign_keys = ON;"); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("enable sqlite foreign keys: %w", err)
		}
	}
	if cfg.busyTimeoutMS > 0 {
		if _, err := db.Exec(fmt.Sprintf("PRAGMA busy_timeout = %d;", cfg.busyTimeoutMS)); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("configure sqlite busy timeout: %w", err)
		}
	}

	s := &Store{db: db}
	if err := s.migrate(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := s.seedIfEmpty(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}

	return s, nil
}

// Close closes the underlying DB connection.
func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) migrate(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS workspaces (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			data TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS environments (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			data TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS history (
			id TEXT PRIMARY KEY,
			workspace_id TEXT,
			environment_id TEXT,
			method TEXT NOT NULL,
			endpoint TEXT NOT NULL,
			status TEXT NOT NULL,
			latency_ms INTEGER NOT NULL DEFAULT 0,
			data TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_history_workspace_env_created ON history (workspace_id, environment_id, created_at DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_history_created ON history (created_at DESC);`,
	}

	for _, stmt := range statements {
		if _, err := s.db.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("apply schema migration: %w", err)
		}
	}

	return nil
}

func (s *Store) seedIfEmpty(ctx context.Context) error {
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM workspaces;`).Scan(&count); err != nil {
		return fmt.Errorf("count workspaces for seed: %w", err)
	}
	if count > 0 {
		return nil
	}

	seed := defaultSeedData()
	for _, env := range seed.Environments {
		if err := s.UpsertEnvironment(ctx, env); err != nil {
			return fmt.Errorf("seed environment %q: %w", env.ID, err)
		}
	}
	for _, ws := range seed.Workspaces {
		if err := s.UpsertWorkspace(ctx, ws); err != nil {
			return fmt.Errorf("seed workspace %q: %w", ws.ID, err)
		}
	}
	for _, item := range seed.History {
		if err := s.AppendHistory(ctx, item); err != nil {
			return fmt.Errorf("seed history item %q: %w", item.ID, err)
		}
	}

	return nil
}

// Bootstrap returns all state needed by the frontend on initial load.
func (s *Store) Bootstrap(ctx context.Context) (model.Bootstrap, error) {
	workspaces, err := s.ListWorkspaces(ctx)
	if err != nil {
		return model.Bootstrap{}, err
	}
	environments, err := s.ListEnvironments(ctx)
	if err != nil {
		return model.Bootstrap{}, err
	}
	history, err := s.ListHistory(ctx, defaultHistoryLimit)
	if err != nil {
		return model.Bootstrap{}, err
	}

	return model.Bootstrap{
		Workspaces:   workspaces,
		Environments: environments,
		History:      history,
	}, nil
}

// ListWorkspaces returns all persisted workspaces.
func (s *Store) ListWorkspaces(ctx context.Context) ([]model.Workspace, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT data FROM workspaces ORDER BY created_at ASC;`)
	if err != nil {
		return nil, fmt.Errorf("query workspaces: %w", err)
	}
	defer rows.Close()

	workspaces := make([]model.Workspace, 0)
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, fmt.Errorf("scan workspace row: %w", err)
		}

		var ws model.Workspace
		if err := json.Unmarshal([]byte(raw), &ws); err != nil {
			return nil, fmt.Errorf("decode workspace row: %w", err)
		}
		workspaces = append(workspaces, ws)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate workspaces rows: %w", err)
	}

	return workspaces, nil
}

// UpsertWorkspace creates or updates one workspace.
func (s *Store) UpsertWorkspace(ctx context.Context, ws model.Workspace) error {
	if strings.TrimSpace(ws.ID) == "" {
		return errors.New("workspace id is required")
	}
	if strings.TrimSpace(ws.Name) == "" {
		return errors.New("workspace name is required")
	}

	raw, err := json.Marshal(ws)
	if err != nil {
		return fmt.Errorf("encode workspace: %w", err)
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO workspaces (id, name, data, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			data = excluded.data,
			updated_at = CURRENT_TIMESTAMP;
	`, ws.ID, ws.Name, string(raw))
	if err != nil {
		return fmt.Errorf("upsert workspace: %w", err)
	}

	return nil
}

// DeleteWorkspace removes one workspace by ID.
func (s *Store) DeleteWorkspace(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("workspace id is required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin workspace delete transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var count int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(1) FROM workspaces;`).Scan(&count); err != nil {
		return fmt.Errorf("count workspaces before delete: %w", err)
	}
	if count <= 1 {
		return ErrLastWorkspace
	}

	result, err := tx.ExecContext(ctx, `DELETE FROM workspaces WHERE id = ?;`, id)
	if err != nil {
		return fmt.Errorf("delete workspace: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect workspace delete result: %w", err)
	}
	if rowsAffected == 0 {
		return ErrWorkspaceNotFound
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit workspace delete transaction: %w", err)
	}

	return nil
}

// ListEnvironments returns all persisted environments.
func (s *Store) ListEnvironments(ctx context.Context) ([]model.Environment, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT data FROM environments ORDER BY created_at ASC;`)
	if err != nil {
		return nil, fmt.Errorf("query environments: %w", err)
	}
	defer rows.Close()

	environments := make([]model.Environment, 0)
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, fmt.Errorf("scan environment row: %w", err)
		}

		var env model.Environment
		if err := json.Unmarshal([]byte(raw), &env); err != nil {
			return nil, fmt.Errorf("decode environment row: %w", err)
		}
		environments = append(environments, env)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate environments rows: %w", err)
	}

	return environments, nil
}

// UpsertEnvironment creates or updates one environment.
func (s *Store) UpsertEnvironment(ctx context.Context, env model.Environment) error {
	if strings.TrimSpace(env.ID) == "" {
		return errors.New("environment id is required")
	}
	if strings.TrimSpace(env.Name) == "" {
		return errors.New("environment name is required")
	}

	raw, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("encode environment: %w", err)
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO environments (id, name, data, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			data = excluded.data,
			updated_at = CURRENT_TIMESTAMP;
	`, env.ID, env.Name, string(raw))
	if err != nil {
		return fmt.Errorf("upsert environment: %w", err)
	}

	return nil
}

// DeleteEnvironment removes one environment by ID.
func (s *Store) DeleteEnvironment(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("environment id is required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin environment delete transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var count int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(1) FROM environments;`).Scan(&count); err != nil {
		return fmt.Errorf("count environments before delete: %w", err)
	}
	if count <= 1 {
		return ErrLastEnvironment
	}

	result, err := tx.ExecContext(ctx, `DELETE FROM environments WHERE id = ?;`, id)
	if err != nil {
		return fmt.Errorf("delete environment: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect environment delete result: %w", err)
	}
	if rowsAffected == 0 {
		return ErrEnvironmentNotFound
	}

	workspaceRows, err := tx.QueryContext(ctx, `SELECT id, data FROM workspaces;`)
	if err != nil {
		return fmt.Errorf("query workspaces for environment cleanup: %w", err)
	}

	updatedWorkspaces := make([]model.Workspace, 0)
	for workspaceRows.Next() {
		var workspaceID string
		var rawWorkspace string
		if err := workspaceRows.Scan(&workspaceID, &rawWorkspace); err != nil {
			_ = workspaceRows.Close()
			return fmt.Errorf("scan workspace during environment cleanup: %w", err)
		}

		var workspace model.Workspace
		if err := json.Unmarshal([]byte(rawWorkspace), &workspace); err != nil {
			_ = workspaceRows.Close()
			return fmt.Errorf("decode workspace during environment cleanup: %w", err)
		}

		if workspace.EnvOverrides == nil {
			continue
		}
		if _, hasOverride := workspace.EnvOverrides[id]; !hasOverride {
			continue
		}

		delete(workspace.EnvOverrides, id)
		if len(workspace.EnvOverrides) == 0 {
			workspace.EnvOverrides = nil
		}
		workspace.ID = workspaceID
		updatedWorkspaces = append(updatedWorkspaces, workspace)
	}
	if err := workspaceRows.Err(); err != nil {
		_ = workspaceRows.Close()
		return fmt.Errorf("iterate workspace cleanup rows: %w", err)
	}
	if err := workspaceRows.Close(); err != nil {
		return fmt.Errorf("close workspace cleanup rows: %w", err)
	}

	for _, workspace := range updatedWorkspaces {
		rawWorkspace, err := json.Marshal(workspace)
		if err != nil {
			return fmt.Errorf("encode cleaned workspace %q: %w", workspace.ID, err)
		}

		if _, err := tx.ExecContext(ctx, `
			UPDATE workspaces
			SET data = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?;
		`, string(rawWorkspace), workspace.ID); err != nil {
			return fmt.Errorf("persist cleaned workspace %q: %w", workspace.ID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit environment delete transaction: %w", err)
	}

	return nil
}

// ListHistory returns recent history entries.
func (s *Store) ListHistory(ctx context.Context, limit int) ([]model.HistoryItem, error) {
	if limit <= 0 {
		limit = defaultHistoryLimit
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT data, created_at
		FROM history
		ORDER BY created_at DESC
		LIMIT ?;
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("query history: %w", err)
	}
	defer rows.Close()

	history := make([]model.HistoryItem, 0)
	for rows.Next() {
		var raw string
		var createdAt string
		if err := rows.Scan(&raw, &createdAt); err != nil {
			return nil, fmt.Errorf("scan history row: %w", err)
		}

		var item model.HistoryItem
		if err := json.Unmarshal([]byte(raw), &item); err != nil {
			return nil, fmt.Errorf("decode history row: %w", err)
		}
		if strings.TrimSpace(item.Timestamp) == "" {
			item.Timestamp = createdAt
		}

		history = append(history, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate history rows: %w", err)
	}

	return history, nil
}

// DeleteHistory removes one history item by ID.
func (s *Store) DeleteHistory(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("history id is required")
	}

	_, err := s.db.ExecContext(ctx, `DELETE FROM history WHERE id = ?;`, id)
	if err != nil {
		return fmt.Errorf("delete history item: %w", err)
	}

	return nil
}

// DeleteHistoryBulk removes multiple history items in a single transaction.
// If ids is empty, all history is deleted.
func (s *Store) DeleteHistoryBulk(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		_, err := s.db.ExecContext(ctx, `DELETE FROM history;`)
		if err != nil {
			return fmt.Errorf("clear all history: %w", err)
		}
		return nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf("DELETE FROM history WHERE id IN (%s);", strings.Join(placeholders, ","))
	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("bulk delete history: %w", err)
	}

	return nil
}

// AppendHistory inserts or updates one history item.
func (s *Store) AppendHistory(ctx context.Context, item model.HistoryItem) error {
	if strings.TrimSpace(item.ID) == "" {
		return errors.New("history id is required")
	}
	if strings.TrimSpace(item.Method) == "" {
		return errors.New("history method is required")
	}
	if strings.TrimSpace(item.Endpoint) == "" {
		return errors.New("history endpoint is required")
	}
	if strings.TrimSpace(item.Status) == "" {
		return errors.New("history status is required")
	}
	if strings.TrimSpace(item.Timestamp) == "" {
		item.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	raw, err := json.Marshal(item)
	if err != nil {
		return fmt.Errorf("encode history item: %w", err)
	}

	latencyMS := parseLatencyMS(item.Latency)

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO history (id, workspace_id, environment_id, method, endpoint, status, latency_ms, data, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
		ON CONFLICT(id) DO UPDATE SET
			workspace_id = excluded.workspace_id,
			environment_id = excluded.environment_id,
			method = excluded.method,
			endpoint = excluded.endpoint,
			status = excluded.status,
			latency_ms = excluded.latency_ms,
			data = excluded.data;
	`,
		item.ID,
		nullIfBlank(item.WorkspaceID),
		nullIfBlank(item.EnvironmentID),
		item.Method,
		item.Endpoint,
		item.Status,
		latencyMS,
		string(raw),
		nullIfBlank(item.Timestamp),
	)
	if err != nil {
		return fmt.Errorf("upsert history item: %w", err)
	}

	return nil
}

func parseLatencyMS(latency string) int {
	value := strings.TrimSpace(strings.ToLower(latency))
	value = strings.TrimSuffix(value, "ms")
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	if parsed < 0 {
		return 0
	}
	return parsed
}

func nullIfBlank(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
