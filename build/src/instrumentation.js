"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PgInstrumentation = void 0;
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
const instrumentation_1 = require("@opentelemetry/instrumentation");
const api_1 = require("@opentelemetry/api");
const utils = require("./utils");
const AttributeNames_1 = require("./enums/AttributeNames");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const version_1 = require("./version");
const utils_1 = require("./utils");
const PG_POOL_COMPONENT = 'pg-pool';
class PgInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super('@opentelemetry/instrumentation-pg', version_1.VERSION, Object.assign({}, config));
    }
    init() {
        const modulePG = new instrumentation_1.InstrumentationNodeModuleDefinition('pg', ['7.*', '8.*'], moduleExports => {
            if (instrumentation_1.isWrapped(moduleExports.Client.prototype.query)) {
                this._unwrap(moduleExports.Client.prototype, 'query');
            }
            if (instrumentation_1.isWrapped(moduleExports.Client.prototype.connect)) {
                this._unwrap(moduleExports.Client.prototype, 'connect');
            }
            this._wrap(moduleExports.Client.prototype, 'query', this._getClientQueryPatch());
            this._wrap(moduleExports.Client.prototype, 'connect', this._getClientConnectPatch());
            return moduleExports;
        }, moduleExports => {
            if (instrumentation_1.isWrapped(moduleExports.Client.prototype.query)) {
                this._unwrap(moduleExports.Client.prototype, 'query');
            }
        });
        const modulePGPool = new instrumentation_1.InstrumentationNodeModuleDefinition('pg-pool', ['2.*', '3.*'], moduleExports => {
            if (instrumentation_1.isWrapped(moduleExports.prototype.connect)) {
                this._unwrap(moduleExports.prototype, 'connect');
            }
            this._wrap(moduleExports.prototype, 'connect', this._getPoolConnectPatch());
            return moduleExports;
        }, moduleExports => {
            if (instrumentation_1.isWrapped(moduleExports.prototype.connect)) {
                this._unwrap(moduleExports.prototype, 'connect');
            }
        });
        return [modulePG, modulePGPool];
    }
    _getClientConnectPatch() {
        const plugin = this;
        return (original) => {
            return function connect(callback) {
                const span = utils_1.startSpan(plugin.tracer, plugin.getConfig(), `${PgInstrumentation.COMPONENT}.connect`, {
                    [semantic_conventions_1.SemanticAttributes.DB_SYSTEM]: semantic_conventions_1.DbSystemValues.POSTGRESQL,
                    [semantic_conventions_1.SemanticAttributes.DB_NAME]: this.database,
                    [semantic_conventions_1.SemanticAttributes.NET_PEER_NAME]: this.host,
                    [semantic_conventions_1.SemanticAttributes.DB_CONNECTION_STRING]: utils.getConnectionString(this),
                    [semantic_conventions_1.SemanticAttributes.NET_PEER_PORT]: this.port,
                    [semantic_conventions_1.SemanticAttributes.DB_USER]: this.user,
                });
                if (callback) {
                    const parentSpan = api_1.trace.getSpan(api_1.context.active());
                    callback = utils.patchClientConnectCallback(span, callback);
                    if (parentSpan) {
                        callback = api_1.context.bind(api_1.context.active(), callback);
                    }
                }
                const connectResult = api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                    return original.call(this, callback);
                });
                return handleConnectResult(span, connectResult);
            };
        };
    }
    _getClientQueryPatch() {
        const plugin = this;
        return (original) => {
            api_1.diag.debug(`Patching ${PgInstrumentation.COMPONENT}.Client.prototype.query`);
            return function query(...args) {
                let span;
                // Handle different client.query(...) signatures
                if (typeof args[0] === 'string') {
                    const query = args[0];
                    if (args.length > 1 && args[1] instanceof Array) {
                        const params = args[1];
                        span = utils.handleParameterizedQuery.call(this, plugin.tracer, plugin.getConfig(), query, params);
                    }
                    else {
                        span = utils.handleTextQuery.call(this, plugin.tracer, plugin.getConfig(), query);
                    }
                }
                else if (typeof args[0] === 'object') {
                    const queryConfig = args[0];
                    span = utils.handleConfigQuery.call(this, plugin.tracer, plugin.getConfig(), queryConfig);
                }
                else {
                    return utils.handleInvalidQuery.call(this, plugin.tracer, plugin.getConfig(), original, ...args);
                }
                // Bind callback to parent span
                if (args.length > 0) {
                    const parentSpan = api_1.trace.getSpan(api_1.context.active());
                    if (typeof args[args.length - 1] === 'function') {
                        // Patch ParameterQuery callback
                        args[args.length - 1] = utils.patchCallback(plugin.getConfig(), span, args[args.length - 1]);
                        // If a parent span exists, bind the callback
                        if (parentSpan) {
                            args[args.length - 1] = api_1.context.bind(api_1.context.active(), args[args.length - 1]);
                        }
                    }
                    else if (typeof args[0].callback === 'function') {
                        // Patch ConfigQuery callback
                        let callback = utils.patchCallback(plugin.getConfig(), span, args[0].callback);
                        // If a parent span existed, bind the callback
                        if (parentSpan) {
                            callback = api_1.context.bind(api_1.context.active(), callback);
                        }
                        // Copy the callback instead of writing to args.callback so that we don't modify user's
                        // original callback reference
                        args[0] = Object.assign(Object.assign({}, args[0]), { callback });
                    }
                }
                // Perform the original query
                const result = original.apply(this, args);
                // Bind promise to parent span and end the span
                if (result instanceof Promise) {
                    return result
                        .then((result) => {
                        // Return a pass-along promise which ends the span and then goes to user's orig resolvers
                        return new Promise(resolve => {
                            utils.handleExecutionResult(plugin.getConfig(), span, result);
                            span.end();
                            resolve(result);
                        });
                    })
                        .catch((error) => {
                        return new Promise((_, reject) => {
                            span.setStatus({
                                code: api_1.SpanStatusCode.ERROR,
                                message: error.message,
                            });
                            span.end();
                            reject(error);
                        });
                    });
                }
                // else returns void
                return result; // void
            };
        };
    }
    _getPoolConnectPatch() {
        const plugin = this;
        return (originalConnect) => {
            return function connect(callback) {
                const connString = utils.getConnectionString(this.options);
                // setup span
                const span = utils_1.startSpan(plugin.tracer, plugin.getConfig(), `${PG_POOL_COMPONENT}.connect`, {
                    [semantic_conventions_1.SemanticAttributes.DB_SYSTEM]: semantic_conventions_1.DbSystemValues.POSTGRESQL,
                    [semantic_conventions_1.SemanticAttributes.DB_NAME]: this.options.database,
                    [semantic_conventions_1.SemanticAttributes.NET_PEER_NAME]: this.options.host,
                    [semantic_conventions_1.SemanticAttributes.DB_CONNECTION_STRING]: connString,
                    [semantic_conventions_1.SemanticAttributes.NET_PEER_PORT]: this.options.port,
                    [semantic_conventions_1.SemanticAttributes.DB_USER]: this.options.user,
                    [AttributeNames_1.AttributeNames.IDLE_TIMEOUT_MILLIS]: this.options.idleTimeoutMillis,
                    [AttributeNames_1.AttributeNames.MAX_CLIENT]: this.options.maxClient,
                });
                if (callback) {
                    const parentSpan = api_1.trace.getSpan(api_1.context.active());
                    callback = utils.patchCallbackPGPool(span, callback);
                    // If a parent span exists, bind the callback
                    if (parentSpan) {
                        callback = api_1.context.bind(api_1.context.active(), callback);
                    }
                }
                const connectResult = api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                    return originalConnect.call(this, callback);
                });
                return handleConnectResult(span, connectResult);
            };
        };
    }
}
exports.PgInstrumentation = PgInstrumentation;
PgInstrumentation.COMPONENT = 'pg';
PgInstrumentation.BASE_SPAN_NAME = PgInstrumentation.COMPONENT + '.query';
function handleConnectResult(span, connectResult) {
    if (!(connectResult instanceof Promise)) {
        return connectResult;
    }
    const connectResultPromise = connectResult;
    return api_1.context.bind(api_1.context.active(), connectResultPromise
        .then(result => {
        span.end();
        return result;
    })
        .catch((error) => {
        span.setStatus({
            code: api_1.SpanStatusCode.ERROR,
            message: error.message,
        });
        span.end();
        return Promise.reject(error);
    }));
}
//# sourceMappingURL=instrumentation.js.map