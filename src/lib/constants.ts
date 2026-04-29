/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GrpcService, HistoryItem, EnvVariable, MetadataHeader, Environment, Workspace } from '../types';

export const MOCK_SERVICES: GrpcService[] = [
  {
    id: 's1',
    name: 'PaymentGateway',
    methods: [
      { 
        id: 'm1', 
        name: 'Authorize', 
        type: 'unary', 
        requestType: 'AuthRequest', 
        responseType: 'AuthResponse',
        requestFields: [
          { name: 'card_number', type: 'string', required: true },
          { name: 'cvv', type: 'string', required: true },
          { name: 'amount', type: 'number', required: true },
          { name: 'billing_address', type: 'message', fields: [
            { name: 'street', type: 'string' },
            { name: 'city', type: 'string' },
            { name: 'zip', type: 'string' }
          ]}
        ]
      },
      { 
        id: 'm2', 
        name: 'ProcessTransaction', 
        type: 'unary', 
        requestType: 'TransactionRequest', 
        responseType: 'TransactionResponse',
        requestFields: [
          { name: 'transaction_id', type: 'string', required: true },
          { name: 'metadata', type: 'string' }
        ]
      },
      { id: 'm3', name: 'Refund', type: 'unary', requestType: 'RefundRequest', responseType: 'RefundResponse' },
      { 
        id: 'm_stream', 
        name: 'WatchTransaction', 
        type: 'server_streaming', 
        requestType: 'WatchRequest', 
        responseType: 'TransactionUpdate',
        requestFields: [
          { name: 'transaction_id', type: 'string' }
        ]
      },
    ],
  },
  {
    id: 's2',
    name: 'CustomerService',
    methods: [
      { 
        id: 'm4', 
        name: 'GetCustomer', 
        type: 'unary', 
        requestType: 'CustomerRequest', 
        responseType: 'CustomerResponse',
        requestFields: [
          { name: 'customer_id', type: 'string' }
        ]
      },
      { id: 'm5', name: 'UpdateProfile', type: 'unary', requestType: 'ProfileRequest', responseType: 'ProfileResponse' },
    ],
  },
];

export const MOCK_ENVIRONMENTS: Environment[] = [
  { 
    id: 'env1', 
    name: 'Local Dev', 
    variables: [
      { id: 'ev1', key: 'API_KEY', value: 'sk-dev-123' },
      { id: 'ev2', key: 'timeout', value: '5000' }
    ],
    headers: [
      { id: 'evh1', key: 'X-Region', value: 'localhost' }
    ]
  },
  { 
    id: 'env2', 
    name: 'Production', 
    variables: [
        { id: 'ev3', key: 'API_KEY', value: 'pk-live-999' },
        { id: 'ev4', key: 'timeout', value: '30000' }
    ],
    headers: [
      { id: 'evh2', key: 'X-Region', value: 'us-east-1' }
    ]
  },
];

export const MOCK_WORKSPACES: Workspace[] = [
  { 
    id: 'w1', 
    name: 'Project Alpha',
    variables: [],
    headers: [],
    services: [MOCK_SERVICES[0]],
    envOverrides: {}
  },
  { 
    id: 'w2', 
    name: 'Project Beta', 
    variables: [{ id: 'evo1', key: 'API_KEY', value: 'ws-override-456' }],
    headers: [],
    services: [MOCK_SERVICES[1]],
    envOverrides: {
      'env2': {
        variables: [{ id: 'evo-prod', key: 'STRICT_MODE', value: 'true' }]
      }
    }
  },
];

export const MOCK_HISTORY: HistoryItem[] = [
  { 
    id: 'h1', 
    timestamp: '2023-10-27 14:32:01', 
    method: 'UserService.GetUser', 
    endpoint: 'localhost:50051', 
    status: 'OK', 
    latency: '42ms',
    requestPayload: { user_id: "usr_123" },
    responsePayload: { id: "usr_123", username: "demo_user", email: "user@example.com" },
    environmentId: 'env1',
    environmentName: 'Local Dev',
    workspaceId: 'w1',
    workspaceName: 'Project Alpha',
    resolvedVariables: [
      { id: 'ev1', key: 'API_KEY', value: 'sk-dev-123' },
      { id: 'ev2', key: 'timeout', value: '5000' }
    ]
  },
  { 
    id: 'h2', 
    timestamp: '2023-10-27 14:31:45', 
    method: 'AuthService.ValidateToken', 
    endpoint: 'grpc.staging.example.com:9090',
    status: 'OK', 
    latency: '18ms',
    requestPayload: { token: "ey..." },
    responsePayload: { valid: true, expires_in: 3600 },
    environmentName: 'Staging',
    workspaceId: 'w1',
    workspaceName: 'Project Alpha',
    resolvedVariables: [
      { id: 'ev-s1', key: 'API_KEY', value: 'sk-staging-777' },
      { id: 'ev-s2', key: 'DEBUG', value: 'true' }
    ]
  },
  { 
    id: 'h3', 
    timestamp: '2023-10-27 14:28:12', 
    method: 'BillingService.ProcessPayment', 
    endpoint: 'billing.prod.svc.cluster.local:443', 
    status: 'INTERNAL', 
    latency: '1205ms',
    requestPayload: { amount: 1450, currency: "USD" },
    responsePayload: { error: "Database timeout" },
    environmentId: 'env2',
    environmentName: 'Production',
    workspaceId: 'w2',
    workspaceName: 'Project Beta',
    resolvedVariables: [
      { id: 'ev3', key: 'API_KEY', value: 'ws-override-456' },
      { id: 'ev4', key: 'timeout', value: '30000' }
    ]
  },
  { 
    id: 'h4', 
    timestamp: '2023-10-27 14:25:00', 
    method: 'InventoryService.CheckStock', 
    endpoint: 'localhost:50052', 
    status: 'NOT_FOUND', 
    latency: '22ms',
    requestPayload: { product_id: "p_999" },
    responsePayload: { error: "Product not found" },
    environmentId: 'env1',
    environmentName: 'Local Dev',
    workspaceId: 'w2',
    workspaceName: 'Project Beta',
    resolvedVariables: [
      { id: 'ev1', key: 'API_KEY', value: 'ws-override-456' },
      { id: 'ev2', key: 'timeout', value: '5000' }
    ]
  },
];

export const MOCK_ENV_VARS: EnvVariable[] = [
  { id: 'e1', key: 'API_KEY', value: 'sk-test-1234567890' },
  { id: 'e2', key: 'HOST', value: 'localhost:50051' },
];

export const MOCK_HEADERS: MetadataHeader[] = [
  { id: 'hd1', key: 'Authorization', value: 'Bearer {{API_KEY}}' },
  { id: 'hd2', key: 'x-client-version', value: '1.0.4' },
];
