import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import * as pgTypes from 'pg';
import * as pgPoolTypes from 'pg-pool';
import { PgInstrumentationConfig } from './types';
export declare class PgInstrumentation extends InstrumentationBase {
    static readonly COMPONENT = "pg";
    static readonly BASE_SPAN_NAME: string;
    constructor(config?: PgInstrumentationConfig);
    protected init(): (InstrumentationNodeModuleDefinition<typeof pgTypes> | InstrumentationNodeModuleDefinition<typeof pgPoolTypes>)[];
    private _getClientConnectPatch;
    private _getClientQueryPatch;
    private _getPoolConnectPatch;
}
//# sourceMappingURL=instrumentation.d.ts.map