import { Span, Tracer, Attributes } from '@opentelemetry/api';
import { PgClientExtended, NormalizedQueryConfig, PostgresCallback, PgClientConnectionParams, PgErrorCallback, PgPoolCallback, PgInstrumentationConfig } from './types';
import * as pgTypes from 'pg';
export declare function getConnectionString(params: PgClientConnectionParams): string;
export declare function startSpan(tracer: Tracer, instrumentationConfig: PgInstrumentationConfig, name: string, attributes: Attributes): Span;
export declare function handleConfigQuery(this: PgClientExtended, tracer: Tracer, instrumentationConfig: PgInstrumentationConfig, queryConfig: NormalizedQueryConfig): Span;
export declare function handleParameterizedQuery(this: PgClientExtended, tracer: Tracer, instrumentationConfig: PgInstrumentationConfig, query: string, values: unknown[]): Span;
export declare function handleTextQuery(this: PgClientExtended, tracer: Tracer, instrumentationConfig: PgInstrumentationConfig, query: string): Span;
/**
 * Invalid query handler. We should never enter this function unless invalid args were passed to the driver.
 * Create and immediately end a new span
 */
export declare function handleInvalidQuery(this: PgClientExtended, tracer: Tracer, instrumentationConfig: PgInstrumentationConfig, originalQuery: typeof pgTypes.Client.prototype.query, ...args: unknown[]): void;
export declare function handleExecutionResult(config: PgInstrumentationConfig, span: Span, pgResult: pgTypes.QueryResult | pgTypes.QueryArrayResult | unknown): void;
export declare function patchCallback(instrumentationConfig: PgInstrumentationConfig, span: Span, cb: PostgresCallback): PostgresCallback;
export declare function patchCallbackPGPool(span: Span, cb: PgPoolCallback): PgPoolCallback;
export declare function patchClientConnectCallback(span: Span, cb: PgErrorCallback): PgErrorCallback;
//# sourceMappingURL=utils.d.ts.map