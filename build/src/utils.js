"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchClientConnectCallback = exports.patchCallbackPGPool = exports.patchCallback = exports.handleExecutionResult = exports.handleInvalidQuery = exports.handleTextQuery = exports.handleParameterizedQuery = exports.handleConfigQuery = exports.startSpan = exports.getConnectionString = void 0;
const api_1 = require("@opentelemetry/api");
const AttributeNames_1 = require("./enums/AttributeNames");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const _1 = require("./");
const instrumentation_1 = require("@opentelemetry/instrumentation");
function arrayStringifyHelper(arr) {
    return '[' + arr.toString() + ']';
}
// Helper function to get a low cardinality command name from the full text query
function getCommandFromText(text) {
    if (!text)
        return 'unknown';
    const words = text.split(' ');
    return words[0].length > 0 ? words[0] : 'unknown';
}
function getConnectionString(params) {
    const host = params.host || 'localhost';
    const port = params.port || 5432;
    const database = params.database || '';
    return `postgresql://${host}:${port}/${database}`;
}
exports.getConnectionString = getConnectionString;
function startSpan(tracer, instrumentationConfig, name, attributes) {
    // If a parent span is required but not present, use a noop span to propagate
    // context without recording it. Adapted from opentelemetry-instrumentation-http:
    // https://github.com/open-telemetry/opentelemetry-js/blob/597ea98e58a4f68bcd9aec5fd283852efe444cd6/experimental/packages/opentelemetry-instrumentation-http/src/http.ts#L660
    const currentSpan = api_1.trace.getSpan(api_1.context.active());
    if (instrumentationConfig.requireParentSpan && currentSpan === undefined) {
        return api_1.trace.wrapSpanContext(api_1.INVALID_SPAN_CONTEXT);
    }
    return tracer.startSpan(name, {
        kind: api_1.SpanKind.CLIENT,
        attributes,
    });
}
exports.startSpan = startSpan;
// Private helper function to start a span
function pgStartSpan(client, tracer, instrumentationConfig, name) {
    const jdbcString = getConnectionString(client.connectionParameters);
    return startSpan(tracer, instrumentationConfig, name, {
        [semantic_conventions_1.SemanticAttributes.DB_NAME]: client.connectionParameters.database,
        [semantic_conventions_1.SemanticAttributes.DB_SYSTEM]: semantic_conventions_1.DbSystemValues.POSTGRESQL,
        [semantic_conventions_1.SemanticAttributes.DB_CONNECTION_STRING]: jdbcString,
        [semantic_conventions_1.SemanticAttributes.NET_PEER_NAME]: client.connectionParameters.host,
        [semantic_conventions_1.SemanticAttributes.NET_PEER_PORT]: client.connectionParameters.port,
        [semantic_conventions_1.SemanticAttributes.DB_USER]: client.connectionParameters.user,
    });
}
// Queries where args[0] is a QueryConfig
function handleConfigQuery(tracer, instrumentationConfig, queryConfig) {
    // Set child span name
    const queryCommand = getCommandFromText(queryConfig.name || queryConfig.text);
    const name = _1.PgInstrumentation.BASE_SPAN_NAME + ':' + queryCommand;
    const span = pgStartSpan(this, tracer, instrumentationConfig, name);
    // Set attributes
    if (queryConfig.text) {
        span.setAttribute(semantic_conventions_1.SemanticAttributes.DB_STATEMENT, queryConfig.text);
    }
    if (instrumentationConfig.enhancedDatabaseReporting &&
        queryConfig.values instanceof Array) {
        span.setAttribute(AttributeNames_1.AttributeNames.PG_VALUES, arrayStringifyHelper(queryConfig.values));
    }
    // Set plan name attribute, if present
    if (queryConfig.name) {
        span.setAttribute(AttributeNames_1.AttributeNames.PG_PLAN, queryConfig.name);
    }
    return span;
}
exports.handleConfigQuery = handleConfigQuery;
// Queries where args[1] is a 'values' array
function handleParameterizedQuery(tracer, instrumentationConfig, query, values) {
    // Set child span name
    const queryCommand = getCommandFromText(query);
    const name = _1.PgInstrumentation.BASE_SPAN_NAME + ':' + queryCommand;
    const span = pgStartSpan(this, tracer, instrumentationConfig, name);
    // Set attributes
    span.setAttribute(semantic_conventions_1.SemanticAttributes.DB_STATEMENT, query);
    if (instrumentationConfig.enhancedDatabaseReporting) {
        span.setAttribute(AttributeNames_1.AttributeNames.PG_VALUES, arrayStringifyHelper(values));
    }
    return span;
}
exports.handleParameterizedQuery = handleParameterizedQuery;
// Queries where args[0] is a text query and 'values' was not specified
function handleTextQuery(tracer, instrumentationConfig, query) {
    // Set child span name
    const queryCommand = getCommandFromText(query);
    const name = _1.PgInstrumentation.BASE_SPAN_NAME + ':' + queryCommand;
    const span = pgStartSpan(this, tracer, instrumentationConfig, name);
    // Set attributes
    span.setAttribute(semantic_conventions_1.SemanticAttributes.DB_STATEMENT, query);
    return span;
}
exports.handleTextQuery = handleTextQuery;
/**
 * Invalid query handler. We should never enter this function unless invalid args were passed to the driver.
 * Create and immediately end a new span
 */
function handleInvalidQuery(tracer, instrumentationConfig, originalQuery, ...args) {
    let result;
    const span = pgStartSpan(this, tracer, instrumentationConfig, _1.PgInstrumentation.BASE_SPAN_NAME);
    try {
        result = originalQuery.apply(this, args);
    }
    catch (e) {
        // span.recordException(e);
        span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: e.message });
        throw e;
    }
    finally {
        span.end();
    }
    return result;
}
exports.handleInvalidQuery = handleInvalidQuery;
function handleExecutionResult(config, span, pgResult) {
    if (typeof config.responseHook === 'function') {
        instrumentation_1.safeExecuteInTheMiddle(() => {
            config.responseHook(span, {
                data: pgResult,
            });
        }, err => {
            if (err) {
                api_1.diag.error('Error running response hook', err);
            }
        }, true);
    }
}
exports.handleExecutionResult = handleExecutionResult;
function patchCallback(instrumentationConfig, span, cb) {
    return function patchedCallback(err, res) {
        if (err) {
            // span.recordException(err);
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: err.message,
            });
        }
        else {
            handleExecutionResult(instrumentationConfig, span, res);
        }
        span.end();
        cb.call(this, err, res);
    };
}
exports.patchCallback = patchCallback;
function patchCallbackPGPool(span, cb) {
    return function patchedCallback(err, res, done) {
        if (err) {
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: err.message,
            });
        }
        span.end();
        cb.call(this, err, res, done);
    };
}
exports.patchCallbackPGPool = patchCallbackPGPool;
function patchClientConnectCallback(span, cb) {
    return function patchedClientConnectCallback(err) {
        if (err) {
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: err.message,
            });
        }
        span.end();
        cb.call(this, err);
    };
}
exports.patchClientConnectCallback = patchClientConnectCallback;
//# sourceMappingURL=utils.js.map