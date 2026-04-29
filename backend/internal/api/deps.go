package api

import (
	"context"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/definitions"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/execute"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/model"
)

// Repository is the persistence port consumed by the API layer.
type Repository interface {
	Bootstrap(ctx context.Context) (model.Bootstrap, error)
	ListWorkspaces(ctx context.Context) ([]model.Workspace, error)
	UpsertWorkspace(ctx context.Context, ws model.Workspace) error
	DeleteWorkspace(ctx context.Context, id string) error
	ListEnvironments(ctx context.Context) ([]model.Environment, error)
	UpsertEnvironment(ctx context.Context, env model.Environment) error
	DeleteEnvironment(ctx context.Context, id string) error
	ListHistory(ctx context.Context, limit int) ([]model.HistoryItem, error)
	AppendHistory(ctx context.Context, item model.HistoryItem) error
	DeleteHistory(ctx context.Context, id string) error
	DeleteHistoryBulk(ctx context.Context, ids []string) error
}

// Executor runs individual gRPC calls.
type Executor interface {
	Execute(ctx context.Context, req execute.Request) (execute.Response, error)
}

// DefinitionResolver discovers gRPC service definitions from reflection or proto files.
type DefinitionResolver interface {
	Reflect(ctx context.Context, req definitions.ReflectRequest) ([]model.GrpcService, error)
	ParseProtoFiles(ctx context.Context, files []definitions.ProtoFile) ([]model.GrpcService, error)
}
