// Package api provides HTTP handlers for the grpc-client backend.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/definitions"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/execute"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/model"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/store"
)

// Router exposes backend HTTP endpoints consumed by the SPA.
type Router struct {
	store       Repository
	executor    Executor
	definitions DefinitionResolver
}

// NewRouter creates a handler with all registered API routes.
func NewRouter(repo Repository, exec Executor, defs DefinitionResolver) *Router {
	return &Router{store: repo, executor: exec, definitions: defs}
}

// Handler builds the net/http router.
func (r *Router) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", r.handleHealth)
	mux.HandleFunc("GET /api/bootstrap", r.handleBootstrap)

	mux.HandleFunc("GET /api/workspaces", r.handleListWorkspaces)
	mux.HandleFunc("POST /api/workspaces", r.handleCreateWorkspace)
	mux.HandleFunc("PUT /api/workspaces/{id}", r.handleUpdateWorkspace)
	mux.HandleFunc("DELETE /api/workspaces/{id}", r.handleDeleteWorkspace)

	mux.HandleFunc("GET /api/environments", r.handleListEnvironments)
	mux.HandleFunc("POST /api/environments", r.handleCreateEnvironment)
	mux.HandleFunc("PUT /api/environments/{id}", r.handleUpdateEnvironment)
	mux.HandleFunc("DELETE /api/environments/{id}", r.handleDeleteEnvironment)

	mux.HandleFunc("GET /api/history", r.handleListHistory)
	mux.HandleFunc("POST /api/history", r.handleAppendHistory)
	mux.HandleFunc("DELETE /api/history/{id}", r.handleDeleteHistory)
	mux.HandleFunc("DELETE /api/history", r.handleDeleteHistoryBulk)

	mux.HandleFunc("POST /api/execute", r.handleExecute)
	mux.HandleFunc("POST /api/definitions/reflect", r.handleReflectDefinitions)
	mux.HandleFunc("POST /api/definitions/proto", r.handleImportProtoDefinitions)
	return mux
}

func (r *Router) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (r *Router) handleBootstrap(w http.ResponseWriter, req *http.Request) {
	bootstrap, err := r.store.Bootstrap(req.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("load bootstrap state: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, bootstrap)
}

func (r *Router) handleListWorkspaces(w http.ResponseWriter, req *http.Request) {
	workspaces, err := r.store.ListWorkspaces(req.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("list workspaces: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workspaces": workspaces})
}

func (r *Router) handleCreateWorkspace(w http.ResponseWriter, req *http.Request) {
	workspace, ok := decodeWorkspace(w, req)
	if !ok {
		return
	}
	if err := r.store.UpsertWorkspace(req.Context(), workspace); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("save workspace: %v", err))
		return
	}
	writeJSON(w, http.StatusCreated, workspace)
}

func (r *Router) handleUpdateWorkspace(w http.ResponseWriter, req *http.Request) {
	workspaceID := strings.TrimSpace(req.PathValue("id"))
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace id is required")
		return
	}

	workspace, ok := decodeWorkspace(w, req)
	if !ok {
		return
	}
	if workspace.ID == "" {
		workspace.ID = workspaceID
	}
	if workspace.ID != workspaceID {
		writeError(w, http.StatusBadRequest, "workspace id in path and body must match")
		return
	}
	if err := r.store.UpsertWorkspace(req.Context(), workspace); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("update workspace: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, workspace)
}

func (r *Router) handleDeleteWorkspace(w http.ResponseWriter, req *http.Request) {
	workspaceID := strings.TrimSpace(req.PathValue("id"))
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace id is required")
		return
	}
	if err := r.store.DeleteWorkspace(req.Context(), workspaceID); err != nil {
		switch {
		case errors.Is(err, store.ErrLastWorkspace):
			writeError(w, http.StatusConflict, err.Error())
		case errors.Is(err, store.ErrWorkspaceNotFound):
			writeError(w, http.StatusNotFound, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("delete workspace: %v", err))
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleListEnvironments(w http.ResponseWriter, req *http.Request) {
	environments, err := r.store.ListEnvironments(req.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("list environments: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"environments": environments})
}

func (r *Router) handleCreateEnvironment(w http.ResponseWriter, req *http.Request) {
	environment, ok := decodeEnvironment(w, req)
	if !ok {
		return
	}
	if err := r.store.UpsertEnvironment(req.Context(), environment); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("save environment: %v", err))
		return
	}
	writeJSON(w, http.StatusCreated, environment)
}

func (r *Router) handleUpdateEnvironment(w http.ResponseWriter, req *http.Request) {
	environmentID := strings.TrimSpace(req.PathValue("id"))
	if environmentID == "" {
		writeError(w, http.StatusBadRequest, "environment id is required")
		return
	}

	environment, ok := decodeEnvironment(w, req)
	if !ok {
		return
	}
	if environment.ID == "" {
		environment.ID = environmentID
	}
	if environment.ID != environmentID {
		writeError(w, http.StatusBadRequest, "environment id in path and body must match")
		return
	}
	if err := r.store.UpsertEnvironment(req.Context(), environment); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("update environment: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, environment)
}

func (r *Router) handleDeleteEnvironment(w http.ResponseWriter, req *http.Request) {
	environmentID := strings.TrimSpace(req.PathValue("id"))
	if environmentID == "" {
		writeError(w, http.StatusBadRequest, "environment id is required")
		return
	}
	if err := r.store.DeleteEnvironment(req.Context(), environmentID); err != nil {
		switch {
		case errors.Is(err, store.ErrLastEnvironment):
			writeError(w, http.StatusConflict, err.Error())
		case errors.Is(err, store.ErrEnvironmentNotFound):
			writeError(w, http.StatusNotFound, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("delete environment: %v", err))
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleListHistory(w http.ResponseWriter, req *http.Request) {
	limit := 500
	if rawLimit := strings.TrimSpace(req.URL.Query().Get("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit <= 0 {
			writeError(w, http.StatusBadRequest, "limit must be a positive integer")
			return
		}
		limit = parsedLimit
	}
	history, err := r.store.ListHistory(req.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("list history: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"history": history})
}

func (r *Router) handleAppendHistory(w http.ResponseWriter, req *http.Request) {
	item, ok := decodeHistoryItem(w, req)
	if !ok {
		return
	}
	if err := r.store.AppendHistory(req.Context(), item); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("append history item: %v", err))
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (r *Router) handleDeleteHistoryBulk(w http.ResponseWriter, req *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := decodeJSON(req, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := r.store.DeleteHistoryBulk(req.Context(), body.IDs); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("bulk delete history: %v", err))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleDeleteHistory(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimSpace(req.PathValue("id"))
	if id == "" {
		writeError(w, http.StatusBadRequest, "history id is required")
		return
	}
	if err := r.store.DeleteHistory(req.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("delete history item: %v", err))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleExecute(w http.ResponseWriter, req *http.Request) {
	var body execute.Request
	if err := decodeJSON(req, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	result, err := r.executor.Execute(req.Context(), body)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("execute request: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (r *Router) handleReflectDefinitions(w http.ResponseWriter, req *http.Request) {
	var body definitions.ReflectRequest
	if err := decodeJSON(req, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	services, err := r.definitions.Reflect(req.Context(), body)
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("discover definitions via reflection: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"services": services})
}

func (r *Router) handleImportProtoDefinitions(w http.ResponseWriter, req *http.Request) {
	if err := req.ParseMultipartForm(20 << 20); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("parse multipart upload: %v", err))
		return
	}
	if req.MultipartForm == nil {
		writeError(w, http.StatusBadRequest, "multipart form data is required")
		return
	}

	fileHeaders := req.MultipartForm.File["files"]
	if len(fileHeaders) == 0 {
		writeError(w, http.StatusBadRequest, "at least one .proto file is required under form field 'files'")
		return
	}

	protoFiles := make([]definitions.ProtoFile, 0, len(fileHeaders))
	for _, fileHeader := range fileHeaders {
		uploadedFile, err := fileHeader.Open()
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("open uploaded file %q: %v", fileHeader.Filename, err))
			return
		}

		rawContent, readErr := io.ReadAll(io.LimitReader(uploadedFile, 8<<20))
		closeErr := uploadedFile.Close()
		if readErr != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("read uploaded file %q: %v", fileHeader.Filename, readErr))
			return
		}
		if closeErr != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("close uploaded file %q: %v", fileHeader.Filename, closeErr))
			return
		}

		protoFiles = append(protoFiles, definitions.ProtoFile{
			Name:    fileHeader.Filename,
			Content: rawContent,
		})
	}

	services, err := r.definitions.ParseProtoFiles(req.Context(), protoFiles)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("parse proto files: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"services": services})
}

func decodeWorkspace(w http.ResponseWriter, req *http.Request) (model.Workspace, bool) {
	var payload model.Workspace
	if err := decodeJSON(req, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return model.Workspace{}, false
	}
	return payload, true
}

func decodeEnvironment(w http.ResponseWriter, req *http.Request) (model.Environment, bool) {
	var payload model.Environment
	if err := decodeJSON(req, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return model.Environment{}, false
	}
	return payload, true
}

func decodeHistoryItem(w http.ResponseWriter, req *http.Request) (model.HistoryItem, bool) {
	var payload model.HistoryItem
	if err := decodeJSON(req, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return model.HistoryItem{}, false
	}
	return payload, true
}

func decodeJSON(req *http.Request, out any) error {
	defer req.Body.Close()

	decoder := json.NewDecoder(io.LimitReader(req.Body, 10<<20))
	if err := decoder.Decode(out); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return errors.New("request body must contain a single JSON object")
		}
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	return nil
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": strings.TrimSpace(message)})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
