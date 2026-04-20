import { OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
export declare class ProxyModule implements OnModuleInit {
    private readonly adapterHost;
    constructor(adapterHost: HttpAdapterHost);
    onModuleInit(): Promise<void>;
}
//# sourceMappingURL=proxy.module.d.ts.map