// Package definitions resolves gRPC service definitions from reflection or uploaded proto files.
package definitions

import (
	"context"
	"crypto/sha1"
	"crypto/tls"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	bufv "buf.build/gen/go/bufbuild/protovalidate/protocolbuffers/go/buf/validate"
	pgv "github.com/envoyproxy/protoc-gen-validate/validate"
	"github.com/fullstorydev/grpcurl"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/desc/protoparse"
	"github.com/jhump/protoreflect/grpcreflect"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/model"
)

//go:embed proto
var bundledProtos embed.FS

// ReflectRequest captures backend reflection inputs.
type ReflectRequest struct {
	Target    string `json:"target"`
	TLS       bool   `json:"tls"`
	Authority string `json:"authority,omitempty"`
}

// ProtoFile carries one uploaded proto file.
type ProtoFile struct {
	Name    string
	Content []byte
}

// ServiceOption configures a Service.
type ServiceOption func(*Service)

// WithDialTimeout overrides the default gRPC dial timeout used during reflection.
func WithDialTimeout(d time.Duration) ServiceOption {
	return func(s *Service) { s.dialTimeout = d }
}

// Service loads gRPC service definitions.
type Service struct {
	dialTimeout time.Duration
}

// NewService creates a definitions service.
func NewService(opts ...ServiceOption) *Service {
	s := &Service{dialTimeout: 10 * time.Second}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Reflect discovers definitions from a live gRPC target using reflection.
func (s *Service) Reflect(ctx context.Context, request ReflectRequest) ([]model.GrpcService, error) {
	target := strings.TrimSpace(request.Target)
	if target == "" {
		return nil, errors.New("target is required")
	}

	dialCtx, cancel := context.WithTimeout(ctx, s.dialTimeout)
	defer cancel()

	dialOptions := []grpc.DialOption{grpc.WithBlock()}
	if request.TLS {
		dialOptions = append(dialOptions, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
	} else {
		dialOptions = append(dialOptions, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}
	if authority := strings.TrimSpace(request.Authority); authority != "" {
		dialOptions = append(dialOptions, grpc.WithAuthority(authority))
	}

	connection, err := grpc.DialContext(dialCtx, target, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("connect to %q for reflection: %w", target, err)
	}
	defer func() { _ = connection.Close() }()

	reflectionClient := grpcreflect.NewClientAuto(dialCtx, connection)
	defer reflectionClient.Reset()

	descriptorSource := grpcurl.DescriptorSourceFromServer(dialCtx, reflectionClient)
	serviceNames, err := descriptorSource.ListServices()
	if err != nil {
		return nil, fmt.Errorf("list reflection services: %w", err)
	}
	sort.Strings(serviceNames)

	serviceDescriptors := make([]*desc.ServiceDescriptor, 0, len(serviceNames))
	for _, serviceName := range serviceNames {
		symbol, findErr := descriptorSource.FindSymbol(serviceName)
		if findErr != nil {
			return nil, fmt.Errorf("resolve reflection symbol %q: %w", serviceName, findErr)
		}
		if sd, ok := symbol.(*desc.ServiceDescriptor); ok {
			serviceDescriptors = append(serviceDescriptors, sd)
		}
	}

	return mapServiceDescriptors(serviceDescriptors), nil
}

// ParseProtoFiles extracts definitions from uploaded proto sources.
// Bundled support protos (google/api, validate/validate.proto for protoc-gen-validate,
// and buf/validate/validate.proto for protovalidate) are provided automatically so
// uploaded files may import them without any additional setup.
func (s *Service) ParseProtoFiles(_ context.Context, files []ProtoFile) ([]model.GrpcService, error) {
	if len(files) == 0 {
		return nil, errors.New("at least one .proto file is required")
	}

	tempDir, err := os.MkdirTemp("", "grpc-client-proto-import-*")
	if err != nil {
		return nil, fmt.Errorf("create temp directory for proto import: %w", err)
	}
	defer os.RemoveAll(tempDir)

	if err := writeBundledProtos(tempDir); err != nil {
		return nil, err
	}

	protoNames := make([]string, 0, len(files))
	for _, file := range files {
		name := sanitizeProtoName(file.Name)
		if name == "" {
			continue
		}
		targetPath := filepath.Join(tempDir, name)
		if !withinPath(targetPath, tempDir) {
			return nil, fmt.Errorf("invalid proto file path: %q", file.Name)
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return nil, fmt.Errorf("create import folder for %q: %w", file.Name, err)
		}
		if err := os.WriteFile(targetPath, file.Content, 0o600); err != nil {
			return nil, fmt.Errorf("write proto file %q: %w", file.Name, err)
		}
		protoNames = append(protoNames, name)
	}

	if len(protoNames) == 0 {
		return nil, errors.New("no valid .proto files provided")
	}

	parser := protoparse.Parser{
		ImportPaths:           []string{tempDir},
		InferImportPaths:      true,
		IncludeSourceCodeInfo: true,
	}

	fileDescriptors, err := parser.ParseFiles(protoNames...)
	if err != nil {
		return nil, fmt.Errorf("parse proto files: %w", err)
	}

	serviceMap := map[string]*desc.ServiceDescriptor{}
	for _, fd := range fileDescriptors {
		for _, sd := range fd.GetServices() {
			serviceMap[sd.GetFullyQualifiedName()] = sd
		}
	}

	serviceDescriptors := make([]*desc.ServiceDescriptor, 0, len(serviceMap))
	for _, sd := range serviceMap {
		serviceDescriptors = append(serviceDescriptors, sd)
	}
	sort.Slice(serviceDescriptors, func(i, j int) bool {
		return serviceDescriptors[i].GetFullyQualifiedName() < serviceDescriptors[j].GetFullyQualifiedName()
	})

	return mapServiceDescriptors(serviceDescriptors), nil
}

// writeBundledProtos copies all embedded support protos into the given temp directory.
func writeBundledProtos(root string) error {
	return fs.WalkDir(bundledProtos, "proto", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel := strings.TrimPrefix(path, "proto/")
		target := filepath.Join(root, filepath.FromSlash(rel))
		if !withinPath(target, root) {
			return fmt.Errorf("bundled proto path %q escapes root", rel)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return fmt.Errorf("create dir for bundled proto %q: %w", rel, err)
		}
		data, readErr := bundledProtos.ReadFile(path)
		if readErr != nil {
			return fmt.Errorf("read bundled proto %q: %w", rel, readErr)
		}
		return os.WriteFile(target, data, 0o600)
	})
}

func mapServiceDescriptors(descriptors []*desc.ServiceDescriptor) []model.GrpcService {
	services := make([]model.GrpcService, 0, len(descriptors))
	for _, sd := range descriptors {
		methods := make([]model.GrpcMethod, 0, len(sd.GetMethods()))
		for _, md := range sd.GetMethods() {
			methods = append(methods, model.GrpcMethod{
				ID:            stableID("m", md.GetFullyQualifiedName()),
				Name:          md.GetName(),
				FullName:      md.GetFullyQualifiedName(),
				Type:          methodType(md),
				RequestType:   md.GetInputType().GetFullyQualifiedName(),
				ResponseType:  md.GetOutputType().GetFullyQualifiedName(),
				RequestFields: mapMessageFields(md.GetInputType(), map[string]bool{}),
			})
		}
		services = append(services, model.GrpcService{
			ID:      stableID("s", sd.GetFullyQualifiedName()),
			Name:    sd.GetName(),
			Methods: methods,
		})
	}
	return services
}

func methodType(method *desc.MethodDescriptor) string {
	switch {
	case method.IsClientStreaming() && method.IsServerStreaming():
		return "bidirectional"
	case method.IsServerStreaming():
		return "server_streaming"
	case method.IsClientStreaming():
		return "client_streaming"
	default:
		return "unary"
	}
}

func mapMessageFields(message *desc.MessageDescriptor, stack map[string]bool) []model.GrpcField {
	if message == nil {
		return nil
	}

	messageName := message.GetFullyQualifiedName()
	if stack[messageName] {
		return nil
	}
	stack[messageName] = true
	defer delete(stack, messageName)

	fields := make([]model.GrpcField, 0, len(message.GetFields()))
	for _, field := range message.GetFields() {
		rules := mergeRules(extractBufValidateRules(field), extractPGVRules(field))
		mapped := model.GrpcField{
			Name:     field.GetName(),
			Type:     scalarType(field),
			Required: field.IsRequired() || isRequiredByComment(field) || containsRule(rules, "required"),
			Rules:    rules,
		}
		if et := field.GetEnumType(); et != nil {
			mapped.Type = "enum"
			values := et.GetValues()
			mapped.EnumValues = make([]string, 0, len(values))
			for _, v := range values {
				mapped.EnumValues = append(mapped.EnumValues, v.GetName())
			}
		}
		if nestedMessage := field.GetMessageType(); nestedMessage != nil {
			mapped.Type = "message"
			mapped.Fields = mapMessageFields(nestedMessage, stack)
		}
		fields = append(fields, mapped)
	}

	return fields
}

// mergeRules combines rule slices, buf validate takes precedence (listed first).
func mergeRules(a, b []string) []string {
	if len(a) == 0 {
		return b
	}
	if len(b) == 0 {
		return a
	}
	merged := make([]string, 0, len(a)+len(b))
	seen := make(map[string]bool, len(a))
	for _, r := range a {
		merged = append(merged, r)
		seen[r] = true
	}
	for _, r := range b {
		if !seen[r] {
			merged = append(merged, r)
		}
	}
	return merged
}

func containsRule(rules []string, rule string) bool {
	for _, r := range rules {
		if r == rule {
			return true
		}
	}
	return false
}

// ── buf validate (protovalidate) extraction ─────────────────────────────────

// extractBufValidateRules extracts human-readable validation rules from
// buf.validate field options (extension field 1159 on FieldOptions).
func extractBufValidateRules(field *desc.FieldDescriptor) []string {
	opts := field.GetFieldOptions()
	if opts == nil || !proto.HasExtension(opts, bufv.E_Field) {
		return nil
	}

	fr, ok := proto.GetExtension(opts, bufv.E_Field).(*bufv.FieldRules)
	if !ok || fr == nil {
		return nil
	}

	var rules []string

	if fr.GetRequired() {
		rules = append(rules, "required")
	}

	if ig := fr.GetIgnore(); ig != bufv.Ignore_IGNORE_UNSPECIFIED {
		rules = append(rules, fmt.Sprintf("ignore=%s", ig))
	}

	for _, cel := range fr.GetCel() {
		if msg := cel.GetMessage(); msg != "" {
			rules = append(rules, fmt.Sprintf("cel: %s", msg))
		}
	}

	switch t := fr.GetType().(type) {
	case *bufv.FieldRules_Float:
		rules = append(rules, bufNumericRulesF32("float", t.Float.GetConst(),
			t.Float.GetLessThan(), t.Float.GetGreaterThan(),
			floatSliceToF64(t.Float.GetIn()), floatSliceToF64(t.Float.GetNotIn()),
			t.Float.GetFinite())...)

	case *bufv.FieldRules_Double:
		rules = append(rules, bufNumericRulesF64("double", t.Double.GetConst(),
			t.Double.GetLessThan(), t.Double.GetGreaterThan(),
			float64Slice(t.Double.GetIn()), float64Slice(t.Double.GetNotIn()),
			t.Double.GetFinite())...)

	case *bufv.FieldRules_Int32:
		rules = append(rules, bufIntRules("int32",
			int64(t.Int32.GetConst()),
			t.Int32.GetLessThan(), t.Int32.GetGreaterThan(),
			int32SliceToI64(t.Int32.GetIn()), int32SliceToI64(t.Int32.GetNotIn()))...)

	case *bufv.FieldRules_Int64:
		rules = append(rules, bufIntRules("int64",
			t.Int64.GetConst(),
			t.Int64.GetLessThan(), t.Int64.GetGreaterThan(),
			t.Int64.GetIn(), t.Int64.GetNotIn())...)

	case *bufv.FieldRules_Uint32:
		rules = append(rules, bufUintRules("uint32",
			uint64(t.Uint32.GetConst()),
			t.Uint32.GetLessThan(), t.Uint32.GetGreaterThan(),
			uint32SliceToU64(t.Uint32.GetIn()), uint32SliceToU64(t.Uint32.GetNotIn()))...)

	case *bufv.FieldRules_Uint64:
		rules = append(rules, bufUintRules("uint64",
			t.Uint64.GetConst(),
			t.Uint64.GetLessThan(), t.Uint64.GetGreaterThan(),
			t.Uint64.GetIn(), t.Uint64.GetNotIn())...)

	case *bufv.FieldRules_Sint32:
		rules = append(rules, bufIntRules("sint32",
			int64(t.Sint32.GetConst()),
			t.Sint32.GetLessThan(), t.Sint32.GetGreaterThan(),
			int32SliceToI64(t.Sint32.GetIn()), int32SliceToI64(t.Sint32.GetNotIn()))...)

	case *bufv.FieldRules_Sint64:
		rules = append(rules, bufIntRules("sint64",
			t.Sint64.GetConst(),
			t.Sint64.GetLessThan(), t.Sint64.GetGreaterThan(),
			t.Sint64.GetIn(), t.Sint64.GetNotIn())...)

	case *bufv.FieldRules_Fixed32:
		rules = append(rules, bufUintRules("fixed32",
			uint64(t.Fixed32.GetConst()),
			t.Fixed32.GetLessThan(), t.Fixed32.GetGreaterThan(),
			uint32SliceToU64(t.Fixed32.GetIn()), uint32SliceToU64(t.Fixed32.GetNotIn()))...)

	case *bufv.FieldRules_Fixed64:
		rules = append(rules, bufUintRules("fixed64",
			t.Fixed64.GetConst(),
			t.Fixed64.GetLessThan(), t.Fixed64.GetGreaterThan(),
			t.Fixed64.GetIn(), t.Fixed64.GetNotIn())...)

	case *bufv.FieldRules_Sfixed32:
		rules = append(rules, bufIntRules("sfixed32",
			int64(t.Sfixed32.GetConst()),
			t.Sfixed32.GetLessThan(), t.Sfixed32.GetGreaterThan(),
			int32SliceToI64(t.Sfixed32.GetIn()), int32SliceToI64(t.Sfixed32.GetNotIn()))...)

	case *bufv.FieldRules_Sfixed64:
		rules = append(rules, bufIntRules("sfixed64",
			t.Sfixed64.GetConst(),
			t.Sfixed64.GetLessThan(), t.Sfixed64.GetGreaterThan(),
			t.Sfixed64.GetIn(), t.Sfixed64.GetNotIn())...)

	case *bufv.FieldRules_Bool:
		if t.Bool.HasConst() {
			rules = append(rules, fmt.Sprintf("const=%v", t.Bool.GetConst()))
		}

	case *bufv.FieldRules_String_:
		rules = append(rules, bufStringRules(t.String_)...)

	case *bufv.FieldRules_Bytes:
		rules = append(rules, bufBytesRules(t.Bytes)...)

	case *bufv.FieldRules_Enum:
		if t.Enum.GetDefinedOnly() {
			rules = append(rules, "definedOnly")
		}
		if in := t.Enum.GetIn(); len(in) > 0 {
			rules = append(rules, fmt.Sprintf("in=%v", in))
		}
		if notIn := t.Enum.GetNotIn(); len(notIn) > 0 {
			rules = append(rules, fmt.Sprintf("notIn=%v", notIn))
		}

	case *bufv.FieldRules_Repeated:
		r := t.Repeated
		if r.GetMinItems() > 0 {
			rules = append(rules, fmt.Sprintf("minItems=%d", r.GetMinItems()))
		}
		if r.GetMaxItems() > 0 {
			rules = append(rules, fmt.Sprintf("maxItems=%d", r.GetMaxItems()))
		}
		if r.GetUnique() {
			rules = append(rules, "unique")
		}

	case *bufv.FieldRules_Map:
		m := t.Map
		if m.GetMinPairs() > 0 {
			rules = append(rules, fmt.Sprintf("minPairs=%d", m.GetMinPairs()))
		}
		if m.GetMaxPairs() > 0 {
			rules = append(rules, fmt.Sprintf("maxPairs=%d", m.GetMaxPairs()))
		}

	case *bufv.FieldRules_Any:
		if in := t.Any.GetIn(); len(in) > 0 {
			rules = append(rules, fmt.Sprintf("in=%v", in))
		}
		if notIn := t.Any.GetNotIn(); len(notIn) > 0 {
			rules = append(rules, fmt.Sprintf("notIn=%v", notIn))
		}

	case *bufv.FieldRules_Duration:
		d := t.Duration
		if c := d.GetConst(); c != nil {
			rules = append(rules, fmt.Sprintf("const=%s", c.AsDuration()))
		}
		switch lt := d.GetLessThan().(type) {
		case *bufv.DurationRules_Lt:
			rules = append(rules, fmt.Sprintf("lt=%s", lt.Lt.AsDuration()))
		case *bufv.DurationRules_Lte:
			rules = append(rules, fmt.Sprintf("lte=%s", lt.Lte.AsDuration()))
		}
		switch gt := d.GetGreaterThan().(type) {
		case *bufv.DurationRules_Gt:
			rules = append(rules, fmt.Sprintf("gt=%s", gt.Gt.AsDuration()))
		case *bufv.DurationRules_Gte:
			rules = append(rules, fmt.Sprintf("gte=%s", gt.Gte.AsDuration()))
		}

	case *bufv.FieldRules_Timestamp:
		ts := t.Timestamp
		if ts.GetLtNow() {
			rules = append(rules, "lt=now")
		}
		if ts.GetGtNow() {
			rules = append(rules, "gt=now")
		}
		if w := ts.GetWithin(); w != nil {
			rules = append(rules, fmt.Sprintf("within=%s", w.AsDuration()))
		}
		switch lt := ts.GetLessThan().(type) {
		case *bufv.TimestampRules_Lt:
			rules = append(rules, fmt.Sprintf("lt=%s", lt.Lt.AsTime()))
		case *bufv.TimestampRules_Lte:
			rules = append(rules, fmt.Sprintf("lte=%s", lt.Lte.AsTime()))
		}
		switch gt := ts.GetGreaterThan().(type) {
		case *bufv.TimestampRules_Gt:
			rules = append(rules, fmt.Sprintf("gt=%s", gt.Gt.AsTime()))
		case *bufv.TimestampRules_Gte:
			rules = append(rules, fmt.Sprintf("gte=%s", gt.Gte.AsTime()))
		}
	}

	return rules
}

// bufStringRules extracts all rules from a buf.validate StringRules.
func bufStringRules(s *bufv.StringRules) []string {
	var rules []string
	if s == nil {
		return rules
	}
	if s.HasConst() {
		rules = append(rules, fmt.Sprintf("const=%q", s.GetConst()))
	}
	if s.GetLen() > 0 {
		rules = append(rules, fmt.Sprintf("len=%d", s.GetLen()))
	}
	if s.GetMinLen() > 0 {
		rules = append(rules, fmt.Sprintf("minLen=%d", s.GetMinLen()))
	}
	if s.GetMaxLen() > 0 {
		rules = append(rules, fmt.Sprintf("maxLen=%d", s.GetMaxLen()))
	}
	if s.GetMinBytes() > 0 {
		rules = append(rules, fmt.Sprintf("minBytes=%d", s.GetMinBytes()))
	}
	if s.GetMaxBytes() > 0 {
		rules = append(rules, fmt.Sprintf("maxBytes=%d", s.GetMaxBytes()))
	}
	if p := s.GetPattern(); p != "" {
		rules = append(rules, fmt.Sprintf("pattern=%q", p))
	}
	if v := s.GetPrefix(); v != "" {
		rules = append(rules, fmt.Sprintf("prefix=%q", v))
	}
	if v := s.GetSuffix(); v != "" {
		rules = append(rules, fmt.Sprintf("suffix=%q", v))
	}
	if v := s.GetContains(); v != "" {
		rules = append(rules, fmt.Sprintf("contains=%q", v))
	}
	if v := s.GetNotContains(); v != "" {
		rules = append(rules, fmt.Sprintf("notContains=%q", v))
	}
	if in := s.GetIn(); len(in) > 0 {
		rules = append(rules, fmt.Sprintf("in=%v", in))
	}
	if notIn := s.GetNotIn(); len(notIn) > 0 {
		rules = append(rules, fmt.Sprintf("notIn=%v", notIn))
	}
	// well-known formats
	for _, check := range []struct {
		flag bool
		name string
	}{
		{s.GetEmail(), "format=email"},
		{s.GetHostname(), "format=hostname"},
		{s.GetIp(), "format=ip"},
		{s.GetIpv4(), "format=ipv4"},
		{s.GetIpv6(), "format=ipv6"},
		{s.GetUri(), "format=uri"},
		{s.GetUriRef(), "format=uri_ref"},
		{s.GetAddress(), "format=address"},
		{s.GetUuid(), "format=uuid"},
		{s.GetTuuid(), "format=tuuid"},
		{s.GetIpWithPrefixlen(), "format=ip_with_prefixlen"},
		{s.GetIpv4WithPrefixlen(), "format=ipv4_with_prefixlen"},
		{s.GetIpv6WithPrefixlen(), "format=ipv6_with_prefixlen"},
		{s.GetIpPrefix(), "format=ip_prefix"},
		{s.GetIpv4Prefix(), "format=ipv4_prefix"},
		{s.GetIpv6Prefix(), "format=ipv6_prefix"},
		{s.GetHostAndPort(), "format=host_and_port"},
		{s.GetUlid(), "format=ulid"},
		{s.GetProtobufFqn(), "format=protobuf_fqn"},
		{s.GetProtobufDotFqn(), "format=protobuf_dot_fqn"},
	} {
		if check.flag {
			rules = append(rules, check.name)
			break // only one well-known format can be set at a time
		}
	}
	switch wk := s.GetWellKnown().(type) {
	case *bufv.StringRules_WellKnownRegex:
		if wk.WellKnownRegex != bufv.KnownRegex_KNOWN_REGEX_UNSPECIFIED {
			rules = append(rules, fmt.Sprintf("format=known_regex:%s", wk.WellKnownRegex))
		}
	}
	return rules
}

// bufBytesRules extracts rules from a buf.validate BytesRules.
func bufBytesRules(b *bufv.BytesRules) []string {
	var rules []string
	if b == nil {
		return rules
	}
	if b.GetMinLen() > 0 {
		rules = append(rules, fmt.Sprintf("minLen=%d", b.GetMinLen()))
	}
	if b.GetMaxLen() > 0 {
		rules = append(rules, fmt.Sprintf("maxLen=%d", b.GetMaxLen()))
	}
	if p := b.GetPattern(); p != "" {
		rules = append(rules, fmt.Sprintf("pattern=%q", p))
	}
	for _, check := range []struct {
		flag bool
		name string
	}{
		{b.GetIp(), "format=ip"},
		{b.GetIpv4(), "format=ipv4"},
		{b.GetIpv6(), "format=ipv6"},
		{b.GetUuid(), "format=uuid"},
	} {
		if check.flag {
			rules = append(rules, check.name)
			break
		}
	}
	return rules
}

// bufNumericRulesF32 builds rules for float32 fields.
func bufNumericRulesF32(typ string, constVal float32, lt, gt any, in, notIn []float64, finite bool) []string {
	var rules []string
	if constVal != 0 {
		rules = append(rules, fmt.Sprintf("const=%g", constVal))
	}
	switch v := lt.(type) {
	case *bufv.FloatRules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%g", v.Lt))
	case *bufv.FloatRules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%g", v.Lte))
	}
	switch v := gt.(type) {
	case *bufv.FloatRules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%g", v.Gt))
	case *bufv.FloatRules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%g", v.Gte))
	}
	if len(in) > 0 {
		rules = append(rules, fmt.Sprintf("in=%v", in))
	}
	if len(notIn) > 0 {
		rules = append(rules, fmt.Sprintf("notIn=%v", notIn))
	}
	if finite {
		rules = append(rules, "finite")
	}
	return rules
}

// bufNumericRulesF64 builds rules for float64 fields.
func bufNumericRulesF64(typ string, constVal float64, lt, gt any, in, notIn []float64, finite bool) []string {
	var rules []string
	if constVal != 0 {
		rules = append(rules, fmt.Sprintf("const=%g", constVal))
	}
	switch v := lt.(type) {
	case *bufv.DoubleRules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%g", v.Lt))
	case *bufv.DoubleRules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%g", v.Lte))
	}
	switch v := gt.(type) {
	case *bufv.DoubleRules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%g", v.Gt))
	case *bufv.DoubleRules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%g", v.Gte))
	}
	if len(in) > 0 {
		rules = append(rules, fmt.Sprintf("in=%v", in))
	}
	if len(notIn) > 0 {
		rules = append(rules, fmt.Sprintf("notIn=%v", notIn))
	}
	if finite {
		rules = append(rules, "finite")
	}
	return rules
}

// bufIntRules builds rules for signed integer fields. The lt/gt parameters
// accept oneof interface values from the generated types.
func bufIntRules(typ string, constVal int64, lt, gt any, in, notIn []int64) []string {
	var rules []string
	if constVal != 0 {
		rules = append(rules, fmt.Sprintf("const=%d", constVal))
	}
	switch v := lt.(type) {
	case *bufv.Int32Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.Int32Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.Int64Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.Int64Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.SInt32Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.SInt32Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.SInt64Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.SInt64Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.SFixed32Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.SFixed32Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.SFixed64Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.SFixed64Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	}
	switch v := gt.(type) {
	case *bufv.Int32Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.Int32Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.Int64Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.Int64Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.SInt32Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.SInt32Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.SInt64Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.SInt64Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.SFixed32Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.SFixed32Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.SFixed64Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.SFixed64Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	}
	if len(in) > 0 {
		rules = append(rules, fmt.Sprintf("in=%v", in))
	}
	if len(notIn) > 0 {
		rules = append(rules, fmt.Sprintf("notIn=%v", notIn))
	}
	return rules
}

// bufUintRules builds rules for unsigned integer fields.
func bufUintRules(typ string, constVal uint64, lt, gt any, in, notIn []uint64) []string {
	var rules []string
	if constVal != 0 {
		rules = append(rules, fmt.Sprintf("const=%d", constVal))
	}
	switch v := lt.(type) {
	case *bufv.UInt32Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.UInt32Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.UInt64Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.UInt64Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.Fixed32Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.Fixed32Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	case *bufv.Fixed64Rules_Lt:
		rules = append(rules, fmt.Sprintf("lt=%d", v.Lt))
	case *bufv.Fixed64Rules_Lte:
		rules = append(rules, fmt.Sprintf("lte=%d", v.Lte))
	}
	switch v := gt.(type) {
	case *bufv.UInt32Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.UInt32Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.UInt64Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.UInt64Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.Fixed32Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.Fixed32Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	case *bufv.Fixed64Rules_Gt:
		rules = append(rules, fmt.Sprintf("gt=%d", v.Gt))
	case *bufv.Fixed64Rules_Gte:
		rules = append(rules, fmt.Sprintf("gte=%d", v.Gte))
	}
	if len(in) > 0 {
		rules = append(rules, fmt.Sprintf("in=%v", in))
	}
	if len(notIn) > 0 {
		rules = append(rules, fmt.Sprintf("notIn=%v", notIn))
	}
	return rules
}

// ── protoc-gen-validate (PGV) extraction ────────────────────────────────────

// extractPGVRules extracts human-readable validation rules from protoc-gen-validate
// field options (extension field 1071 on FieldOptions).
func extractPGVRules(field *desc.FieldDescriptor) []string {
	opts := field.GetFieldOptions()
	if opts == nil || !proto.HasExtension(opts, pgv.E_Rules) {
		return nil
	}

	rules, ok := proto.GetExtension(opts, pgv.E_Rules).(*pgv.FieldRules)
	if !ok || rules == nil {
		return nil
	}

	var result []string

	if msg := rules.GetMessage(); msg != nil && msg.GetRequired() {
		result = append(result, "required")
	}

	switch r := rules.GetType().(type) {
	case *pgv.FieldRules_String_:
		s := r.String_
		if s.GetMinLen() > 0 {
			result = append(result, fmt.Sprintf("minLen=%d", s.GetMinLen()))
		}
		if s.GetMaxLen() > 0 {
			result = append(result, fmt.Sprintf("maxLen=%d", s.GetMaxLen()))
		}
		if s.GetPattern() != "" {
			result = append(result, fmt.Sprintf("pattern=%q", s.GetPattern()))
		}
		for _, check := range []struct {
			flag bool
			name string
		}{
			{s.GetEmail(), "format=email"},
			{s.GetUri(), "format=uri"},
			{s.GetUuid(), "format=uuid"},
			{s.GetIp(), "format=ip"},
			{s.GetIpv4(), "format=ipv4"},
			{s.GetIpv6(), "format=ipv6"},
			{s.GetHostname(), "format=hostname"},
			{s.GetAddress(), "format=address"},
		} {
			if check.flag {
				result = append(result, check.name)
				break
			}
		}
		if in := s.GetIn(); len(in) > 0 {
			result = append(result, fmt.Sprintf("in=%v", in))
		}

	case *pgv.FieldRules_Int32:
		n := r.Int32
		if n.GetGt() != 0 {
			result = append(result, fmt.Sprintf("gt=%d", n.GetGt()))
		}
		if n.GetGte() != 0 {
			result = append(result, fmt.Sprintf("gte=%d", n.GetGte()))
		}
		if n.GetLt() != 0 {
			result = append(result, fmt.Sprintf("lt=%d", n.GetLt()))
		}
		if n.GetLte() != 0 {
			result = append(result, fmt.Sprintf("lte=%d", n.GetLte()))
		}

	case *pgv.FieldRules_Int64:
		n := r.Int64
		if n.GetGt() != 0 {
			result = append(result, fmt.Sprintf("gt=%d", n.GetGt()))
		}
		if n.GetGte() != 0 {
			result = append(result, fmt.Sprintf("gte=%d", n.GetGte()))
		}
		if n.GetLt() != 0 {
			result = append(result, fmt.Sprintf("lt=%d", n.GetLt()))
		}
		if n.GetLte() != 0 {
			result = append(result, fmt.Sprintf("lte=%d", n.GetLte()))
		}

	case *pgv.FieldRules_Uint32:
		n := r.Uint32
		if n.GetGt() != 0 {
			result = append(result, fmt.Sprintf("gt=%d", n.GetGt()))
		}
		if n.GetGte() != 0 {
			result = append(result, fmt.Sprintf("gte=%d", n.GetGte()))
		}
		if n.GetLt() != 0 {
			result = append(result, fmt.Sprintf("lt=%d", n.GetLt()))
		}
		if n.GetLte() != 0 {
			result = append(result, fmt.Sprintf("lte=%d", n.GetLte()))
		}

	case *pgv.FieldRules_Uint64:
		n := r.Uint64
		if n.GetGt() != 0 {
			result = append(result, fmt.Sprintf("gt=%d", n.GetGt()))
		}
		if n.GetGte() != 0 {
			result = append(result, fmt.Sprintf("gte=%d", n.GetGte()))
		}
		if n.GetLt() != 0 {
			result = append(result, fmt.Sprintf("lt=%d", n.GetLt()))
		}
		if n.GetLte() != 0 {
			result = append(result, fmt.Sprintf("lte=%d", n.GetLte()))
		}

	case *pgv.FieldRules_Float:
		n := r.Float
		if n.GetGt() != 0 {
			result = append(result, fmt.Sprintf("gt=%g", n.GetGt()))
		}
		if n.GetLt() != 0 {
			result = append(result, fmt.Sprintf("lt=%g", n.GetLt()))
		}

	case *pgv.FieldRules_Double:
		n := r.Double
		if n.GetGt() != 0 {
			result = append(result, fmt.Sprintf("gt=%g", n.GetGt()))
		}
		if n.GetLt() != 0 {
			result = append(result, fmt.Sprintf("lt=%g", n.GetLt()))
		}

	case *pgv.FieldRules_Bytes:
		b := r.Bytes
		if b.GetMinLen() > 0 {
			result = append(result, fmt.Sprintf("minLen=%d", b.GetMinLen()))
		}
		if b.GetMaxLen() > 0 {
			result = append(result, fmt.Sprintf("maxLen=%d", b.GetMaxLen()))
		}

	case *pgv.FieldRules_Enum:
		if r.Enum.GetDefinedOnly() {
			result = append(result, "definedOnly")
		}

	case *pgv.FieldRules_Repeated:
		rep := r.Repeated
		if rep.GetMinItems() > 0 {
			result = append(result, fmt.Sprintf("minItems=%d", rep.GetMinItems()))
		}
		if rep.GetMaxItems() > 0 {
			result = append(result, fmt.Sprintf("maxItems=%d", rep.GetMaxItems()))
		}
		if rep.GetUnique() {
			result = append(result, "unique")
		}
	}

	return result
}

// ── comment-based required detection ────────────────────────────────────────

// isRequiredByComment checks whether a field's source comment marks it as required.
func isRequiredByComment(field *desc.FieldDescriptor) bool {
	info := field.GetSourceInfo()
	if info == nil {
		return false
	}
	for _, block := range []string{info.GetLeadingComments(), info.GetTrailingComments()} {
		for _, line := range strings.Split(block, "\n") {
			lower := strings.ToLower(strings.TrimSpace(line))
			if lower == "required" || strings.HasPrefix(lower, "required:") || strings.HasPrefix(lower, "required ") {
				return true
			}
		}
	}
	return false
}

// ── helpers ──────────────────────────────────────────────────────────────────

func scalarType(field *desc.FieldDescriptor) string {
	switch field.GetType().String() {
	case "TYPE_BOOL":
		return "boolean"
	case "TYPE_INT32", "TYPE_SINT32", "TYPE_SFIXED32", "TYPE_UINT32", "TYPE_FIXED32",
		"TYPE_INT64", "TYPE_SINT64", "TYPE_SFIXED64", "TYPE_UINT64", "TYPE_FIXED64",
		"TYPE_FLOAT", "TYPE_DOUBLE":
		return "number"
	default:
		return "string"
	}
}

func stableID(prefix, value string) string {
	hash := sha1.Sum([]byte(value))
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(hash[:4]))
}

func sanitizeProtoName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return ""
	}
	cleaned := filepath.Clean(trimmed)
	if cleaned == "." || strings.HasPrefix(cleaned, "..") || filepath.IsAbs(cleaned) {
		return ""
	}
	if ext := strings.ToLower(filepath.Ext(cleaned)); ext != ".proto" {
		return ""
	}
	return cleaned
}

func withinPath(candidate, root string) bool {
	rel, err := filepath.Rel(root, candidate)
	if err != nil {
		return false
	}
	if rel == "." {
		return true
	}
	if rel == ".." {
		return false
	}
	return !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// ── slice conversion helpers ─────────────────────────────────────────────────

func floatSliceToF64(in []float32) []float64 {
	out := make([]float64, len(in))
	for i, v := range in {
		out[i] = float64(v)
	}
	return out
}

func float64Slice(in []float64) []float64 { return in }

func int32SliceToI64(in []int32) []int64 {
	out := make([]int64, len(in))
	for i, v := range in {
		out[i] = int64(v)
	}
	return out
}

func uint32SliceToU64(in []uint32) []uint64 {
	out := make([]uint64, len(in))
	for i, v := range in {
		out[i] = uint64(v)
	}
	return out
}
