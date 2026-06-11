import test from "node:test";
import assert from "node:assert/strict";

import {
  replayTimeline
} from "../../repositories/replayRepository.js";

test(
  "timeline replay is deterministic",
  () => {

    const identityId =
      "a059cab0-1db4-49df-a5fd-d6f0ce8867ce";

    const replayA =
      replayTimeline(
        identityId
      );

    const replayB =
      replayTimeline(
        identityId
      );

    assert.deepEqual(
      replayA,
      replayB
    );
  }
);

test(
  "timeline contains historical artifacts",
  () => {

    const identityId =
      "a059cab0-1db4-49df-a5fd-d6f0ce8867ce";

    const replay =
      replayTimeline(
        identityId
      );

    const types =
      replay.timeline.map(
        entry => entry.type
      );

    assert.ok(
      types.includes(
        "event"
      )
    );

    assert.ok(
      types.includes(
        "assessment"
      )
    );

    assert.ok(
      types.includes(
        "outcome"
      )
    );
  }
);
