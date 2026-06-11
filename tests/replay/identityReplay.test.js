import test from "node:test";
import assert from "node:assert/strict";

import {
  replayIdentity
} from "../../repositories/replayRepository.js";

test(
  "identity replay is deterministic",
  () => {

    const identityId =
      "a059cab0-1db4-49df-a5fd-d6f0ce8867ce";

    const replayA =
      replayIdentity(
        identityId
      );

    const replayB =
      replayIdentity(
        identityId
      );

    assert.deepEqual(
      replayA,
      replayB
    );
  }
);
