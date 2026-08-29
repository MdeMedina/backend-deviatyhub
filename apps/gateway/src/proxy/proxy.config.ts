export interface ProxyTarget {
  prefix: string;
  target: string;
}

export const PROXY_CONFIG: ProxyTarget[] = [
  { prefix: '/api/auth', target: 'http://localhost:3001/api/auth' },
  { prefix: '/api/core', target: 'http://localhost:3002/api' }, // Core service usually handles multiple resources under /api
  { prefix: '/api/agent', target: 'http://localhost:3003/api/agent' },
  { prefix: '/api/notifications', target: 'http://localhost:3004/api/notifications' },
  { prefix: '/api/webhooks', target: 'http://localhost:3005/api/webhooks' },
];
