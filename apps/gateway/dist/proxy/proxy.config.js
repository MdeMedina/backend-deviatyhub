"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROXY_CONFIG = void 0;
exports.PROXY_CONFIG = [
    { prefix: '/api/auth', target: 'http://localhost:3001' },
    { prefix: '/api/core', target: 'http://localhost:3002' },
    { prefix: '/api/agent', target: 'http://localhost:3003' },
    { prefix: '/api/notifications', target: 'http://localhost:3004' },
    { prefix: '/api/webhooks', target: 'http://localhost:3005' },
];
//# sourceMappingURL=proxy.config.js.map