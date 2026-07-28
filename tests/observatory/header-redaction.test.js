import test from "node:test";
import assert from "node:assert/strict";

import { withoutIdentifiers, IDENTIFYING_HEADERS } from "../../public-site/captureHook.js";

// The capture stored raw headers, and on 28 July 2026 the record was found to
// hold 520 Cookie values carrying a stable per-visitor identifier. Nothing here
// sets a cookie, reads one, or has ever computed a published figure from one.
//
// The rule is narrow on purpose: the header NAME stays, because which headers a
// client sends is part of how it behaves and is exactly the kind of thing this
// site measures. Only the value goes.

test("a cookie value is replaced and its name kept", () => {
  const out = withoutIdentifiers({
    "user-agent": "Mozilla/5.0",
    cookie: "_tccl_visitor=1070b696-694c-49de-98fe-9761734ceabf"
  });

  assert.equal(out.cookie, "[redacted]");
  assert.equal(out["user-agent"], "Mozilla/5.0", "everything else is untouched");
  assert.ok("cookie" in out, "the name must survive — that a cookie was sent is an observation");
});

test("header names are matched however they are cased", () => {
  for (const name of ["Cookie", "COOKIE", "Authorization", "Proxy-Authorization", "Set-Cookie"]) {
    const out = withoutIdentifiers({ [name]: "secret" });
    assert.equal(out[name], "[redacted]", `${name} must be redacted`);
  }
});

test("nothing that describes a request is redacted", () => {
  // These carry no identity and several are load-bearing for published figures.
  const kept = {
    "cf-connecting-ip": "203.0.113.9",
    "accept-language": "en-GB,en;q=0.9",
    "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2)",
    referer: "https://example.com/",
    "cf-ipcountry": "TR",
    "content-length": "0"
  };

  assert.deepEqual(withoutIdentifiers(kept), kept);
});

test("the redaction list names only headers that carry identity", () => {
  // A guard against the list quietly growing to cover something measured.
  assert.deepEqual(
    [...IDENTIFYING_HEADERS].sort(),
    ["authorization", "cookie", "proxy-authorization", "set-cookie"]
  );
});
