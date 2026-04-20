export interface ProxyTarget {
  prefix: string;
  target: string;
}

export const PROXY_CONFIG: ProxyTarget[] = [
  { prefix: '/api/auth', target: 'http://localhost:3001' },
  { prefix: '/api/core', target: 'http://localhost:3002' },
  { prefix: '/api/agent', target: 'http://localhost:3003' },
  { prefix: '/api/notifications', target: 'http://localhost:3004' },
  { prefix: '/api/webhooks', target: 'http://localhost:3005' },
];
