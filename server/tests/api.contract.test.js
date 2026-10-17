import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/src/app.js";

let baseUrl;
let server;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("GET /health returns the API status without a database connection", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, "ok");
  assert.equal(body.data.service, "event-platform-api");
  assert.ok(Date.parse(body.data.timestamp));
});

test("protected API paths reject unauthenticated requests with the standard error response", async () => {
  const response = await fetch(`${baseUrl}/api/v1/not-a-route`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(typeof body.code, "string");
});

test("registration rejects an invalid payload before persistence", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "short", fullName: "A" }),
  });
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.code, "VALIDATION_ERROR");
});
