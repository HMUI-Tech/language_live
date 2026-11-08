import test from "node:test";
import assert from "node:assert/strict";
import { safeFailure, clientError } from "../lib/api-errors.mjs";
import { secureResponse } from "../lib/security-headers.mjs";
test("internal failures never echo SQL, stack details or server values", () => {
  assert.equal(
    safeFailure(new Error("SQL failed with secret=internal-value")).status,
    503,
  );
  assert(
    !safeFailure(
      new Error("SQL failed with secret=internal-value"),
    ).message.includes("SQL"),
  );
  assert.equal(
    safeFailure(clientError("Reload before spending.", 409)).status,
    409,
  );
  assert.equal(
    safeFailure(Object.assign(new Error("internal"), { status: 400 })).status,
    503,
  );
});
test("learning HTML has CSP and transport, frame and browser capability safeguards", () => {
  const r = secureResponse(
    new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    "https://site.test/learn",
  );
  assert.match(
    r.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.match(r.headers.get("strict-transport-security"), /max-age=/);
  assert.match(r.headers.get("permissions-policy"), /microphone=\(\)/);
});
