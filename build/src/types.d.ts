import * as pgTypes from 'pg';
import * as pgPoolTypes from 'pg-pool';
import type * as api from '@opentelemetry/api';
import { InstrumentationConfig } from '@opentelemetry/instrumentation';
export interface PgResponseHookInformation {
    data: pgTypes.QueryResult | pgTypes.QueryArrayResult;
}
export interface PgInstrumentationExecutionResponseHook {
    (span: api.Span, responseInfo: PgResponseHookInformation): void;
}
export interface PgInstrumentationConfig extends InstrumentationConfig {
    /**
     * If true, additional information about query parameters will be attached (as `attributes`) to spans representing
     */
    enhancedDatabaseReporting?: boolean;
    /**
     * Hook that allows adding custom span attributes based on the data
     * returned from "query" Pg actions.
     *
     * @default undefined
     */
    responseHook?: PgInstrumentationExecutionResponseHook;
    /** Require that is a parent span to create new spans. Defaults to false. */
    requireParentSpan?: boolean;
}
export declare type PostgresCallback = (err: Error, res: object) => unknown;
export interface PgClientConnectionParams {
    database?: string;
    host?: string;
    port?: number;
    user?: string;
}
export interface PgClientExtended extends pgTypes.Client {
    connectionParameters: PgClientConnectionParams;
}
export interface NormalizedQueryConfig extends pgTypes.QueryConfig {
    callback?: PostgresCallback;
}
export declare type PgPoolCallback = (err: Error, client: any, done: (release?: any) => void) => void;
export declare type PgErrorCallback = (err: Error) => void;
export interface PgPoolOptionsParams {
    database: string;
    host: string;
    port: number;
    user: string;
    idleTimeoutMillis: number;
    maxClient: number;
}
export interface PgPoolExtended extends pgPoolTypes<pgTypes.Client> {
    options: PgPoolOptionsParams;
}
export declare type PgClientConnect = (callback?: (err: Error) => void) => Promise<void> | void;
//# sourceMappingURL=types.d.ts.map