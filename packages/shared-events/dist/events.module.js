"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedEventsModule = exports.EVENT_BUS_TOKEN = void 0;
const common_1 = require("@nestjs/common");
const event_bus_1 = require("./event-bus");
exports.EVENT_BUS_TOKEN = 'EVENT_BUS';
let SharedEventsModule = class SharedEventsModule {
};
exports.SharedEventsModule = SharedEventsModule;
exports.SharedEventsModule = SharedEventsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.EVENT_BUS_TOKEN,
                useFactory: () => {
                    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
                    try {
                        const url = new URL(redisUrl);
                        return new event_bus_1.EventBus({
                            host: url.hostname || 'localhost',
                            port: parseInt(url.port) || 6379,
                            password: url.password || undefined,
                            tls: url.protocol === 'rediss:' ? {} : undefined,
                            maxRetriesPerRequest: null,
                            lazyConnect: false,
                        });
                    }
                    catch {
                        return new event_bus_1.EventBus({
                            host: 'localhost',
                            port: 6379,
                            maxRetriesPerRequest: null,
                            lazyConnect: false,
                        });
                    }
                },
            },
            {
                provide: event_bus_1.EventBus,
                useExisting: exports.EVENT_BUS_TOKEN,
            },
        ],
        exports: [exports.EVENT_BUS_TOKEN, event_bus_1.EventBus],
    })
], SharedEventsModule);
//# sourceMappingURL=events.module.js.map