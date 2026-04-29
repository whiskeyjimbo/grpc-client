/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, GrpcMethod, GrpcService, HistoryItem, Workspace } from '../types';
import { BootstrapResponse, ExecuteResponse, DefinitionsResponse } from './client';

const SAMPLE_SERVICES: GrpcService[] = [
  {
    id: 's_sample_v1',
    name: 'sample.v1.OrderService',
    methods: [
      {
        id: 'm_place_order',
        name: 'PlaceOrder',
        fullName: 'sample.v1.OrderService/PlaceOrder',
        type: 'unary',
        requestType: 'PlaceOrderRequest',
        responseType: 'PlaceOrderResponse',
        requestFields: [
          { name: 'order_id', type: 'string', required: true, rules: ['min_len: 4', 'prefix: ord_'] },
          { name: 'customer_email', type: 'string', required: true, rules: ['email'] },
          { name: 'quantity', type: 'number', rules: ['gt: 0', 'lte: 1000'] },
          { name: 'unit_price', type: 'number', rules: ['gt: 0.0'] },
          { name: 'currency', type: 'string', rules: ['in: [USD, EUR, GBP]'] },
          { name: 'shipping_address', type: 'message', required: true, fields: [
            { name: 'street', type: 'string', rules: ['min_len: 1'] },
            { name: 'city', type: 'string', rules: ['min_len: 1'] },
            { name: 'zip', type: 'string', rules: ['pattern: ^[0-9]{5}$'] },
            { name: 'country', type: 'string', rules: ['len: 2'] }
          ]}
        ]
      },
      {
        id: 'm_search_orders',
        name: 'SearchOrders',
        fullName: 'sample.v1.OrderService/SearchOrders',
        type: 'unary',
        requestType: 'SearchOrdersRequest',
        responseType: 'SearchOrdersResponse',
        requestFields: [
          { name: 'request_id', type: 'string', rules: ['uuid'] },
          { name: 'query', type: 'string', rules: ['max_len: 256'] },
          { name: 'page', type: 'number', rules: ['gte: 1'] },
          { name: 'page_size', type: 'number', rules: ['gt: 0', 'lte: 100'] },
          { name: 'region_host', type: 'string', rules: ['hostname'] }
        ]
      },
      {
        id: 'm_update_inventory',
        name: 'UpdateInventory',
        fullName: 'sample.v1.OrderService/UpdateInventory',
        type: 'unary',
        requestType: 'UpdateInventoryRequest',
        responseType: 'UpdateInventoryResponse',
        requestFields: [
          { name: 'sku', type: 'string', required: true, rules: ['pattern: ^[A-Z0-9-]+$'] },
          { name: 'delta', type: 'number', rules: ['gt: -1000', 'lt: 1000'] },
          { name: 'reason', type: 'number', rules: ['defined_only'] },
          { name: 'tags', type: 'string', repeated: true, rules: ['max_items: 10'] },
          { name: 'audit', type: 'message', required: true, fields: [
            { name: 'operator_id', type: 'string', rules: ['min_len: 1'] },
            { name: 'note', type: 'string', rules: ['max_len: 512'] }
          ]}
        ]
      }
    ]
  }
];

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  // Return an empty workspace to force users through the "Connect & Reflect" onboarding flow
  return {
    workspaces: [
      {
        id: 'ws_demo',
        name: 'Demo Workspace',
        variables: [
          { id: 'v_host', key: 'HOST', value: 'demo.grpc.api:50051' }
        ],
        headers: [],
        services: []
      }
    ],
    environments: [
      {
        id: 'env_demo',
        name: 'Production',
        variables: [],
        headers: []
      }
    ],
    history: [],
  };
}

export async function executeRequest(input: {
  method: GrpcMethod;
  requestPayload: any;
  endpoint: string;
}): Promise<ExecuteResponse> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600));
  
  let responseBody: any = {
    message: `This is a mocked response for ${input.method.name}`,
    received_at: new Date().toISOString(),
    demo_mode: true,
    status: "SUCCESS"
  };

  // Structured responses based on the sample proto methods
  if (input.method.name === 'PlaceOrder') {
    responseBody = {
      order_id: input.requestPayload?.order_id || `ord_${Math.floor(Math.random() * 1000000)}`,
      status: 'PLACED',
      estimated_delivery: new Date(Date.now() + 86400000 * 3).toISOString(),
      customer: input.requestPayload?.customer_email || 'guest@example.com',
      total_price: Number(((input.requestPayload?.quantity || 1) * (input.requestPayload?.unit_price || 29.99)).toFixed(2)),
      currency: input.requestPayload?.currency || 'USD'
    };
  } else if (input.method.name === 'SearchOrders') {
    responseBody = {
      orders: [
        { order_id: 'ord_1234', status: 'SHIPPED', total_price: 150.00 },
        { order_id: 'ord_5678', status: 'DELIVERED', total_price: 42.50 },
        { order_id: 'ord_9012', status: 'PROCESSING', total_price: 12.99 },
        { order_id: 'ord_3456', status: 'CANCELLED', total_price: 89.00 }
      ].slice(0, Math.floor(Math.random() * 4) + 1),
      total: 15,
      page: input.requestPayload?.page || 1,
      page_size: input.requestPayload?.page_size || 10
    };
  } else if (input.method.name === 'UpdateInventory') {
    responseBody = {
      new_quantity: Math.max(0, Math.floor(Math.random() * 1000)),
      sku: input.requestPayload?.sku || 'DEMO-SKU-001',
      updated_at: new Date().toISOString(),
      audit_log_id: `log_${Math.random().toString(36).substring(7)}`
    };
  }

  return {
    status: 0,
    statusText: 'OK',
    body: JSON.stringify(responseBody, null, 2),
    headers: {
      'content-type': 'application/json',
      'x-demo-mode': 'true',
      'grpc-status': '0',
      'grpc-message': 'OK',
      'server': 'gRPC-Mock-Server/1.0'
    },
    timeMs: Math.floor(40 + Math.random() * 60),
  };
}

export async function upsertWorkspace(workspace: Workspace): Promise<Workspace> {
  return workspace;
}

export async function deleteWorkspace(_id: string): Promise<void> {
  return Promise.resolve();
}

export async function upsertEnvironment(environment: Environment): Promise<Environment> {
  return environment;
}

export async function deleteEnvironment(_id: string): Promise<void> {
  return Promise.resolve();
}

export async function deleteHistory(_id: string): Promise<void> {
  return Promise.resolve();
}

export async function deleteHistoryBulk(_ids: string[]): Promise<void> {
  return Promise.resolve();
}

export async function appendHistory(item: HistoryItem): Promise<HistoryItem> {
  return item;
}

export async function reflectDefinitions(_input: any): Promise<DefinitionsResponse> {
  await new Promise(resolve => setTimeout(resolve, 1200));
  return { services: SAMPLE_SERVICES };
}

export async function importProtoFiles(_files: File[]): Promise<DefinitionsResponse> {
  return { services: [] };
}
