import { Queue } from 'bullmq';
export declare const messageQueue: Queue<any, any, string, any, any, string>;
/**
 * Encola un payload de webhook para procesamiento posterior
 * @param channel Canal de origen ('whatsapp' | 'instagram')
 * @param payload El JSON crudo recibido del webhook
 */
export declare function enqueueMessage(channel: string, payload: any): Promise<void>;
//# sourceMappingURL=queue.d.ts.map