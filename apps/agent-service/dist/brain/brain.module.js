"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainModule = void 0;
const common_1 = require("@nestjs/common");
const brain_service_1 = require("./brain.service");
const intention_classifier_1 = require("./intention.classifier");
const state_manager_1 = require("./state.manager");
const availability_tool_1 = require("../tools/availability.tool");
const human_tool_1 = require("../tools/human.tool");
const appointment_actions_tool_1 = require("../tools/appointment-actions.tool");
const shared_events_1 = require("@deviaty/shared-events");
let BrainModule = class BrainModule {
};
exports.BrainModule = BrainModule;
exports.BrainModule = BrainModule = __decorate([
    (0, common_1.Module)({
        imports: [shared_events_1.SharedEventsModule],
        providers: [
            brain_service_1.BrainService,
            intention_classifier_1.IntentionClassifier,
            state_manager_1.StateManager,
            availability_tool_1.AvailabilityTool,
            human_tool_1.HumanTool,
            appointment_actions_tool_1.AppointmentActionsTool
        ],
        exports: [brain_service_1.BrainService],
    })
], BrainModule);
//# sourceMappingURL=brain.module.js.map