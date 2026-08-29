export interface ProxyTarget {
  prefix: string;
  target: string;
}

// Base de cada microservicio. En Docker se inyectan por env apuntando a los
// hostnames de la red (p.ej. http://auth-service:3001). En local caen a
// localhost para desarrollo sin contenedores.
const AUTH = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const CORE = process.env.CORE_SERVICE_URL || 'http://localhost:3002';
const AGENT = process.env.AGENT_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATIONS = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
const WEBHOOKS = process.env.WEBHOOK_SERVICE_URL || 'http://localhost:3005';

export const PROXY_CONFIG: ProxyTarget[] = [
  { prefix: '/api/auth', target: `${AUTH}/api/auth` },
  { prefix: '/api/core', target: `${CORE}/api` }, // Core service usually handles multiple resources under /api
  { prefix: '/api/agent', target: `${AGENT}/api/agent` },
  { prefix: '/api/notifications', target: `${NOTIFICATIONS}/api/notifications` },
  { prefix: '/api/webhooks', target: `${WEBHOOKS}/api/webhooks` },
];
