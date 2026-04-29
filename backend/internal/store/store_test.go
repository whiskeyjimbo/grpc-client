package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/model"
)

func TestStoreSeedsBootstrapData(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "grpcclient.db")
	s, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer func() {
		_ = s.Close()
	}()

	bootstrap, err := s.Bootstrap(context.Background())
	if err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	if len(bootstrap.Workspaces) == 0 {
		t.Fatalf("expected seeded workspaces")
	}
	if len(bootstrap.Environments) == 0 {
		t.Fatalf("expected seeded environments")
	}
}

func TestStorePersistsWorkspaceAcrossReopen(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "grpcclient.db")
	ctx := context.Background()

	s, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}

	workspace := model.Workspace{
		ID:        "ws-persist",
		Name:      "Persist Check",
		Variables: []model.EnvVariable{},
		Headers:   []model.MetadataHeader{},
		Services:  []model.GrpcService{},
	}
	if err := s.UpsertWorkspace(ctx, workspace); err != nil {
		t.Fatalf("upsert workspace: %v", err)
	}

	if err := s.Close(); err != nil {
		t.Fatalf("close store: %v", err)
	}

	s2, err := Open(dbPath)
	if err != nil {
		t.Fatalf("reopen store: %v", err)
	}
	defer func() {
		_ = s2.Close()
	}()

	workspaces, err := s2.ListWorkspaces(ctx)
	if err != nil {
		t.Fatalf("list workspaces after reopen: %v", err)
	}

	found := false
	for _, ws := range workspaces {
		if ws.ID == workspace.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("workspace %q not found after reopen", workspace.ID)
	}
}

func TestDeleteWorkspaceBlocksLastWorkspace(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "grpcclient.db")
	s, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer func() {
		_ = s.Close()
	}()

	ctx := context.Background()
	workspaces, err := s.ListWorkspaces(ctx)
	if err != nil {
		t.Fatalf("list workspaces: %v", err)
	}
	if len(workspaces) < 2 {
		t.Fatalf("expected at least two seeded workspaces, got %d", len(workspaces))
	}

	for index := 0; index < len(workspaces)-1; index += 1 {
		if err := s.DeleteWorkspace(ctx, workspaces[index].ID); err != nil {
			t.Fatalf("delete workspace %q: %v", workspaces[index].ID, err)
		}
	}

	remainingWorkspaces, err := s.ListWorkspaces(ctx)
	if err != nil {
		t.Fatalf("list workspaces after deletes: %v", err)
	}
	if len(remainingWorkspaces) != 1 {
		t.Fatalf("expected one workspace after deletes, got %d", len(remainingWorkspaces))
	}

	err = s.DeleteWorkspace(ctx, remainingWorkspaces[0].ID)
	if !errors.Is(err, ErrLastWorkspace) {
		t.Fatalf("expected ErrLastWorkspace, got %v", err)
	}
}

func TestDeleteEnvironmentCleansOverridesAndBlocksLastEnvironment(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "grpcclient.db")
	s, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer func() {
		_ = s.Close()
	}()

	ctx := context.Background()

	if err := s.DeleteEnvironment(ctx, "env2"); err != nil {
		t.Fatalf("delete environment env2: %v", err)
	}

	workspaces, err := s.ListWorkspaces(ctx)
	if err != nil {
		t.Fatalf("list workspaces after env delete: %v", err)
	}
	for _, workspace := range workspaces {
		if workspace.EnvOverrides == nil {
			continue
		}
		if _, hasEnvOverride := workspace.EnvOverrides["env2"]; hasEnvOverride {
			t.Fatalf("workspace %q still contains env2 overrides", workspace.ID)
		}
	}

	environments, err := s.ListEnvironments(ctx)
	if err != nil {
		t.Fatalf("list environments after first delete: %v", err)
	}
	if len(environments) != 1 {
		t.Fatalf("expected one environment after delete, got %d", len(environments))
	}

	err = s.DeleteEnvironment(ctx, environments[0].ID)
	if !errors.Is(err, ErrLastEnvironment) {
		t.Fatalf("expected ErrLastEnvironment, got %v", err)
	}
}
