// Package model defines shared API and persistence models for grpc-client backend.
package model

type GrpcField struct {
	Name       string      `json:"name"`
	Type       string      `json:"type"`
	Required   bool        `json:"required,omitempty"`
	Rules      []string    `json:"rules,omitempty"`
	EnumValues []string    `json:"enumValues,omitempty"`
	Fields     []GrpcField `json:"fields,omitempty"`
}

type GrpcMethod struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	FullName      string      `json:"fullName,omitempty"`
	Type          string      `json:"type"`
	RequestType   string      `json:"requestType"`
	ResponseType  string      `json:"responseType"`
	RequestFields []GrpcField `json:"requestFields,omitempty"`
}

type GrpcService struct {
	ID      string       `json:"id"`
	Name    string       `json:"name"`
	Methods []GrpcMethod `json:"methods"`
}

type MetadataHeader struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

type EnvVariable struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

type ConnectionPolicy struct {
	EnableTLS        bool `json:"enableTls"`
	InsecureTLS      bool `json:"insecureTls,omitempty"`
	TimeoutMS        int  `json:"timeoutMs"`
	MaxReceiveSizeMB int  `json:"maxReceiveSizeMb"`
}

type LatencyThresholds struct {
	Slow     int `json:"slow"`
	Critical int `json:"critical"`
}

type UIConfig struct {
	LatencyThresholds     LatencyThresholds `json:"latencyThresholds"`
	HistoryRetentionCount int               `json:"historyRetentionCount"`
	ThemeID               string            `json:"themeId,omitempty"`
}

type EnvOverride struct {
	Variables        []EnvVariable     `json:"variables,omitempty"`
	Headers          []MetadataHeader  `json:"headers,omitempty"`
	ConnectionPolicy *ConnectionPolicy `json:"connectionPolicy,omitempty"`
	UIConfig         *UIConfig         `json:"uiConfig,omitempty"`
}

type Workspace struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	Variables        []EnvVariable          `json:"variables"`
	Headers          []MetadataHeader       `json:"headers"`
	Services         []GrpcService          `json:"services"`
	ConnectionPolicy *ConnectionPolicy      `json:"connectionPolicy,omitempty"`
	UIConfig         *UIConfig              `json:"uiConfig,omitempty"`
	EnvOverrides     map[string]EnvOverride `json:"envOverrides,omitempty"`
}

type Environment struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Variables []EnvVariable    `json:"variables"`
	Headers   []MetadataHeader `json:"headers"`
}

type HistoryItem struct {
	ID                string            `json:"id"`
	Timestamp         string            `json:"timestamp"`
	Method            string            `json:"method"`
	Endpoint          string            `json:"endpoint"`
	Status            string            `json:"status"`
	Latency           string            `json:"latency"`
	RequestPayload    any               `json:"requestPayload"`
	ResponsePayload   any               `json:"responsePayload"`
	ResponseHeaders   map[string]string `json:"responseHeaders,omitempty"`
	EnvironmentID     string            `json:"environmentId,omitempty"`
	EnvironmentName   string            `json:"environmentName"`
	WorkspaceID       string            `json:"workspaceId,omitempty"`
	WorkspaceName     string            `json:"workspaceName"`
	ResolvedVariables []EnvVariable     `json:"resolvedVariables,omitempty"`
}

type Bootstrap struct {
	Workspaces   []Workspace   `json:"workspaces"`
	Environments []Environment `json:"environments"`
	History      []HistoryItem `json:"history"`
}
