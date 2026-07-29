import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRecorder, withoutIdentifiers } from "../../recorder/recorder.js";
import { nodeRecorder } from "../../recorder/adapters.js";

const tmp = () => join(mkdtempSync(join(tmpdir(), "rec-")), "record.db");

test("a served request becomes exactly one row", async () => {
  const file = tmp();
  const recorder = createRecorder({ file });
  const server = http.createServer((_req, res) => {
    res.setHeader("content-type", "text/plain");
    res.setHeader("content-length", "5");
    res.statusCode = 200;
    res.end("hello");
  });
  nodeRecorder(server, recorder);

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  await fetch(`http://127.0.0.1:${port}/a/page?x=1`, {
    headers: { "user-agent": "TestBot/1.0", cookie: "sid=secret-value" }
  });
  await new Promise((r) => setTimeout(r, 60));

  const rows = recorder.db.prepare("SELECT * FROM RequestReality").all();
  assert.equal(rows.length, 1, "one request, one row");

  const [row] = rows;
  assert.equal(row.path, "/a/page");
  assert.equal(row.query, "x=1", "the query string is kept separate from the path");
  assert.equal(row.userAgent, "TestBot/1.0");
  assert.equal(row.responseStatus, 200);
  assert.equal(row.responseBytes, 5);
  assert.ok(row.responseTimeMs >= 0);

  const headers = JSON.parse(row.headersJson);
  assert.equal(headers.cookie, "[redacted]", "the cookie value must not be stored");
  assert.ok("cookie" in headers, "that a cookie was sent is an observation and is kept");

  server.close();
  recorder.close();
  rmSync(file, { force: true });
});

test("a failure to observe is not a failure to serve", async () => {
  const file = tmp();
  const recorder = createRecorder({ file });

  // The worst realistic case: the store stops accepting writes while the site is
  // up. The request must still be answered.
  recorder.db.close();

  const server = http.createServer((_req, res) => res.end("still here"));
  nodeRecorder(server, recorder);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "still here");

  server.close();
  rmSync(file, { force: true });
});

test("cf-connecting-ip wins over a forwarded header that anyone can set", () => {
  const file = tmp();
  const recorder = createRecorder({ file, trustForwarded: true });

  recorder.record({
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.99, 10.0.0.1"
    },
    url: "/",
    remoteAddr: "127.0.0.1"
  });

  const row = recorder.db.prepare("SELECT * FROM RequestReality").get();
  assert.equal(row.cfConnectingIp, "203.0.113.10");
  assert.equal(row.xForwardedFor, "198.51.100.99, 10.0.0.1", "the raw claim is kept too");

  recorder.close();
  rmSync(file, { force: true });
});

test("a forwarded header is ignored unless it is explicitly trusted", () => {
  const file = tmp();
  const recorder = createRecorder({ file }); // trustForwarded defaults to false

  recorder.record({
    headers: { "x-forwarded-for": "203.0.113.77" },
    url: "/",
    remoteAddr: "127.0.0.1"
  });

  const row = recorder.db.prepare("SELECT * FROM RequestReality").get();
  assert.equal(
    row.cfConnectingIp,
    "127.0.0.1",
    "an untrusted forwarded address must not become the client address"
  );

  recorder.close();
  rmSync(file, { force: true });
});

test("every identifying header is redacted and nothing else is", () => {
  const kept = {
    "user-agent": "Mozilla/5.0",
    "accept-language": "tr-TR",
    referer: "https://example.com/",
    "cf-connecting-ip": "203.0.113.1"
  };
  const out = withoutIdentifiers({
    ...kept,
    Cookie: "a=1",
    AUTHORIZATION: "Bearer x",
    "proxy-authorization": "Basic y",
    "set-cookie": "b=2"
  });

  for (const [k, v] of Object.entries(kept)) assert.equal(out[k], v);
  for (const k of ["Cookie", "AUTHORIZATION", "proxy-authorization", "set-cookie"])
    assert.equal(out[k], "[redacted]", `${k} must be redacted whatever its casing`);
});

test("the package contains no statement that modifies a stored row", async () => {
  // The record is INSERT-only, and that is a property of the code rather than a
  // promise in a README. If this ever fails, the guarantee in the README is no
  // longer true and one of the two has to change.
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../../recorder/", import.meta.url).pathname;

  for (const name of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const source = readFileSync(join(dir, name), "utf8");
    // cli.js opens the database readonly; the others must not name these at all.
    assert.doesNotMatch(
      source,
      /\b(UPDATE|DELETE\s+FROM|DROP\s+TABLE)\b/i,
      `${name} contains a statement that could modify the record`
    );
  }
});
