"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributeNames = void 0;
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
// Postgresql specific attributes not covered by semantic conventions
var AttributeNames;
(function (AttributeNames) {
    AttributeNames["PG_VALUES"] = "db.postgresql.values";
    AttributeNames["PG_PLAN"] = "db.postgresql.plan";
    AttributeNames["IDLE_TIMEOUT_MILLIS"] = "db.postgresql.idle.timeout.millis";
    AttributeNames["MAX_CLIENT"] = "db.postgresql.max.client";
})(AttributeNames = exports.AttributeNames || (exports.AttributeNames = {}));
//# sourceMappingURL=AttributeNames.js.map