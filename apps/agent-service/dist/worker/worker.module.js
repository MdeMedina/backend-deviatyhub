"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerModule = exports.BrainModule = void 0;
// apps/agent-service/src/brain/brain.module.ts
const common_1 = require("@nestjs/common");
const brain_service_1 = require("./brain.service");
let BrainModule = class BrainModule {
};
exports.BrainModule = BrainModule;
exports.BrainModule = brain_module_1.BrainModule = __decorate([
    (0, common_1.Module)({
        providers: [brain_service_1.BrainService],
        exports: [brain_service_1.BrainService],
    })
], brain_module_1.BrainModule);
const agent_processor_1 = require("./agent.processor");
const brain_module_1 = require("../brain/brain.module");
Object.defineProperty(exports, "BrainModule", { enumerable: true, get: function () { return brain_module_1.BrainModule; } });
let WorkerModule = class WorkerModule {
};
exports.WorkerModule = WorkerModule;
exports.WorkerModule = WorkerModule = __decorate([
    (0, common_1.Module)({
        imports: [brain_module_1.BrainModule],
        providers: [agent_processor_1.AgentProcessor],
    })
], WorkerModule);
//# sourceMappingURL=worker.module.js.map