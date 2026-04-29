package store

import "github.com/whiskeyjimbo/grpc-client/backend/internal/model"

func defaultSeedData() model.Bootstrap {
	paymentService := model.GrpcService{
		ID:   "s1",
		Name: "PaymentGateway",
		Methods: []model.GrpcMethod{
			{
				ID:           "m1",
				Name:         "Authorize",
				Type:         "unary",
				RequestType:  "AuthRequest",
				ResponseType: "AuthResponse",
				RequestFields: []model.GrpcField{
					{Name: "card_number", Type: "string", Required: true},
					{Name: "cvv", Type: "string", Required: true},
					{Name: "amount", Type: "number", Required: true},
					{
						Name: "billing_address",
						Type: "message",
						Fields: []model.GrpcField{
							{Name: "street", Type: "string"},
							{Name: "city", Type: "string"},
							{Name: "zip", Type: "string"},
						},
					},
				},
			},
			{
				ID:           "m2",
				Name:         "ProcessTransaction",
				Type:         "unary",
				RequestType:  "TransactionRequest",
				ResponseType: "TransactionResponse",
				RequestFields: []model.GrpcField{
					{Name: "transaction_id", Type: "string", Required: true},
					{Name: "metadata", Type: "string"},
				},
			},
			{
				ID:            "m_stream",
				Name:          "WatchTransaction",
				Type:          "server_streaming",
				RequestType:   "WatchRequest",
				ResponseType:  "TransactionUpdate",
				RequestFields: []model.GrpcField{{Name: "transaction_id", Type: "string"}},
			},
		},
	}

	customerService := model.GrpcService{
		ID:   "s2",
		Name: "CustomerService",
		Methods: []model.GrpcMethod{
			{
				ID:            "m4",
				Name:          "GetCustomer",
				Type:          "unary",
				RequestType:   "CustomerRequest",
				ResponseType:  "CustomerResponse",
				RequestFields: []model.GrpcField{{Name: "customer_id", Type: "string"}},
			},
			{
				ID:           "m5",
				Name:         "UpdateProfile",
				Type:         "unary",
				RequestType:  "ProfileRequest",
				ResponseType: "ProfileResponse",
			},
		},
	}

	environments := []model.Environment{
		{
			ID:   "env1",
			Name: "Local Dev",
			Variables: []model.EnvVariable{
				{ID: "ev1", Key: "API_KEY", Value: "sk-dev-123"},
				{ID: "ev2", Key: "timeout", Value: "5000"},
				{ID: "evh", Key: "HOST", Value: "localhost:50051"},
			},
			Headers: []model.MetadataHeader{{ID: "evh1", Key: "X-Region", Value: "localhost"}},
		},
		{
			ID:   "env2",
			Name: "Production",
			Variables: []model.EnvVariable{
				{ID: "ev3", Key: "API_KEY", Value: "pk-live-999"},
				{ID: "ev4", Key: "timeout", Value: "30000"},
			},
			Headers: []model.MetadataHeader{{ID: "evh2", Key: "X-Region", Value: "us-east-1"}},
		},
	}

	workspaces := []model.Workspace{
		{
			ID:           "w1",
			Name:         "Project Alpha",
			Variables:    []model.EnvVariable{},
			Headers:      []model.MetadataHeader{},
			Services:     []model.GrpcService{paymentService},
			EnvOverrides: map[string]model.EnvOverride{},
		},
		{
			ID:        "w2",
			Name:      "Project Beta",
			Variables: []model.EnvVariable{{ID: "evo1", Key: "API_KEY", Value: "ws-override-456"}},
			Headers:   []model.MetadataHeader{},
			Services:  []model.GrpcService{customerService},
			EnvOverrides: map[string]model.EnvOverride{
				"env2": {
					Variables: []model.EnvVariable{{ID: "evo-prod", Key: "STRICT_MODE", Value: "true"}},
				},
			},
		},
	}

	return model.Bootstrap{
		Workspaces:   workspaces,
		Environments: environments,
		History:      []model.HistoryItem{},
	}
}
