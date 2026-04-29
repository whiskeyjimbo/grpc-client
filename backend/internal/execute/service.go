// Package execute runs backend request execution for grpc-client.
package execute

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/fullstorydev/grpcurl"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/dynamic"
	"github.com/jhump/protoreflect/dynamic/grpcdynamic"
	"github.com/jhump/protoreflect/grpcreflect"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/model"
)

// Request captures one API execute request from the frontend.
type Request struct {
	Method         model.GrpcMethod `json:"method"`
	RequestPayload any              `json:"requestPayload"`
	Endpoint       string           `json:"endpoint"`
	TLS            bool             `json:"tls"`
	TimeoutMS      int              `json:"timeoutMs"`
}

// Response captures one backend execute response.
type Response struct {
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Body       string            `json:"body"`
	Headers    map[string]string `json:"headers"`
	TimeMS     int               `json:"timeMs"`
	Messages   []map[string]any  `json:"messages,omitempty"`
}

// Service executes requests.
type Service struct{}

// NewService creates an execution service.
func NewService() *Service {
	return &Service{}
}

// Execute runs one request.
func (s *Service) Execute(ctx context.Context, req Request) (Response, error) {
	if strings.TrimSpace(req.Method.Name) == "" && strings.TrimSpace(req.Method.FullName) == "" {
		return Response{}, errors.New("method name is required")
	}

	endpoint := strings.TrimSpace(req.Endpoint)
	if endpoint == "" {
		return Response{}, errors.New("endpoint is required")
	}
	if strings.ContainsAny(endpoint, " \t\n\r") {
		return Response{}, fmt.Errorf("invalid endpoint %q", endpoint)
	}

	timeout := 5 * time.Second
	if req.TimeoutMS > 0 {
		timeout = time.Duration(req.TimeoutMS) * time.Millisecond
	}

	callCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	dialOptions := []grpc.DialOption{grpc.WithBlock()}
	if req.TLS {
		dialOptions = append(dialOptions, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
	} else {
		dialOptions = append(dialOptions, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	connection, err := grpc.DialContext(callCtx, endpoint, dialOptions...)
	if err != nil {
		return Response{}, fmt.Errorf("connect to %q: %w", endpoint, err)
	}
	defer func() {
		_ = connection.Close()
	}()

	reflectionClient := grpcreflect.NewClientAuto(callCtx, connection)
	defer reflectionClient.Reset()

	descriptorSource := grpcurl.DescriptorSourceFromServer(callCtx, reflectionClient)
	methodDescriptor, err := resolveMethodDescriptor(descriptorSource, req.Method)
	if err != nil {
		return Response{}, err
	}

	if methodDescriptor.IsClientStreaming() || methodDescriptor.IsServerStreaming() {
		return Response{}, fmt.Errorf("streaming method %q is not yet supported by /api/execute", methodDescriptor.GetFullyQualifiedName())
	}

	payload := req.RequestPayload
	if payload == nil {
		payload = map[string]any{}
	}

	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return Response{}, fmt.Errorf("encode request payload: %w", err)
	}

	requestMessage := dynamic.NewMessage(methodDescriptor.GetInputType())
	if err := requestMessage.UnmarshalJSON(rawPayload); err != nil {
		return Response{}, fmt.Errorf("decode request payload for %s: %w", methodDescriptor.GetFullyQualifiedName(), err)
	}

	stub := grpcdynamic.NewStub(connection)
	headers := metadata.MD{}
	trailers := metadata.MD{}

	startedAt := time.Now()
	responseMessage, invokeErr := stub.InvokeRpc(callCtx, methodDescriptor, requestMessage, grpc.Header(&headers), grpc.Trailer(&trailers))
	elapsedMS := int(time.Since(startedAt).Milliseconds())

	responseHeaders := metadataToSingleValueMap(headers)
	for key, value := range metadataToSingleValueMap(trailers) {
		responseHeaders["trailer-"+key] = value
	}

	if invokeErr != nil {
		statusErr, ok := status.FromError(invokeErr)
		if !ok {
			return Response{}, fmt.Errorf("invoke %s: %w", methodDescriptor.GetFullyQualifiedName(), invokeErr)
		}

		errorBody, bodyErr := json.MarshalIndent(map[string]any{
			"error":   statusErr.Message(),
			"code":    statusErr.Code().String(),
			"details": formatStatusDetails(statusErr),
		}, "", "  ")
		if bodyErr != nil {
			return Response{}, fmt.Errorf("encode gRPC error response body: %w", bodyErr)
		}

		return Response{
			Status:     int(statusErr.Code()),
			StatusText: statusErr.Code().String(),
			Body:       string(errorBody),
			Headers:    responseHeaders,
			TimeMS:     elapsedMS,
		}, nil
	}

	body, err := marshalResponseBody(responseMessage)
	if err != nil {
		return Response{}, err
	}

	return Response{
		Status:     0,
		StatusText: "OK",
		Body:       body,
		Headers:    responseHeaders,
		TimeMS:     elapsedMS,
	}, nil
}

func resolveMethodDescriptor(source grpcurl.DescriptorSource, method model.GrpcMethod) (*desc.MethodDescriptor, error) {
	if fullName := strings.TrimSpace(method.FullName); fullName != "" {
		symbol, err := source.FindSymbol(fullName)
		if err == nil {
			if descriptor, ok := symbol.(*desc.MethodDescriptor); ok {
				return descriptor, nil
			}
		}
	}

	serviceNames, err := source.ListServices()
	if err != nil {
		return nil, fmt.Errorf("list services for method resolution: %w", err)
	}

	candidates := make([]*desc.MethodDescriptor, 0)
	for _, serviceName := range serviceNames {
		symbol, symbolErr := source.FindSymbol(serviceName)
		if symbolErr != nil {
			continue
		}

		serviceDescriptor, ok := symbol.(*desc.ServiceDescriptor)
		if !ok {
			continue
		}

		for _, descriptor := range serviceDescriptor.GetMethods() {
			if method.Name != "" && !strings.EqualFold(descriptor.GetName(), method.Name) {
				continue
			}
			if method.RequestType != "" && normalizeTypeName(descriptor.GetInputType().GetFullyQualifiedName()) != normalizeTypeName(method.RequestType) {
				continue
			}
			if method.ResponseType != "" && normalizeTypeName(descriptor.GetOutputType().GetFullyQualifiedName()) != normalizeTypeName(method.ResponseType) {
				continue
			}
			candidates = append(candidates, descriptor)
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("unable to resolve method %q (%q -> %q) from server reflection", method.Name, method.RequestType, method.ResponseType)
	}
	if len(candidates) > 1 {
		candidateNames := make([]string, 0, len(candidates))
		for _, candidate := range candidates {
			candidateNames = append(candidateNames, candidate.GetFullyQualifiedName())
		}
		sort.Strings(candidateNames)
		return nil, fmt.Errorf("method selection is ambiguous for %q: %s", method.Name, strings.Join(candidateNames, ", "))
	}

	return candidates[0], nil
}

func normalizeTypeName(value string) string {
	return strings.TrimPrefix(strings.TrimSpace(value), ".")
}

func metadataToSingleValueMap(md metadata.MD) map[string]string {
	if len(md) == 0 {
		return map[string]string{}
	}

	result := make(map[string]string, len(md))
	for key, values := range md {
		result[key] = strings.Join(values, ", ")
	}
	return result
}

func formatStatusDetails(statusErr *status.Status) []string {
	details := statusErr.Details()
	if len(details) == 0 {
		return nil
	}

	formatted := make([]string, 0, len(details))
	for _, detail := range details {
		formatted = append(formatted, fmt.Sprintf("%T: %v", detail, detail))
	}

	return formatted
}

func marshalResponseBody(message any) (string, error) {
	if dynamicMessage, ok := message.(*dynamic.Message); ok {
		rawJSON, err := dynamicMessage.MarshalJSON()
		if err != nil {
			return "", fmt.Errorf("marshal dynamic response: %w", err)
		}

		var prettyBody bytes.Buffer
		if err := json.Indent(&prettyBody, rawJSON, "", "  "); err != nil {
			return string(rawJSON), nil
		}
		return prettyBody.String(), nil
	}

	rawJSON, err := json.MarshalIndent(message, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal response: %w", err)
	}

	return string(rawJSON), nil
}
