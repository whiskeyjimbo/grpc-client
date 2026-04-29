package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/definitions"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/model"
)

func main() {
	content, err := os.ReadFile(os.Args[1])
	if err != nil {
		log.Fatalf("read proto: %v", err)
	}

	svc := definitions.NewService()
	services, err := svc.ParseProtoFiles(context.Background(), []definitions.ProtoFile{
		{Name: "validation_sample.proto", Content: content},
	})
	if err != nil {
		log.Fatalf("parse: %v", err)
	}

	for _, s := range services {
		fmt.Printf("Service: %s\n", s.Name)
		for _, m := range s.Methods {
			fmt.Printf("  Method: %s\n", m.Name)
			printFields(m.RequestFields, "    ")
		}
	}
}

func printFields(fields []model.GrpcField, indent string) {
	for _, f := range fields {
		req := ""
		if f.Required {
			req = " *"
		}
		enumPart := ""
		if len(f.EnumValues) > 0 {
			enumPart = fmt.Sprintf("  enum=%v", f.EnumValues)
		}
		fmt.Printf("%s%s (%s)%s  rules=%v%s\n", indent, f.Name, f.Type, req, f.Rules, enumPart)
		if len(f.Fields) > 0 {
			printFields(f.Fields, indent+"  ")
		}
	}
}
