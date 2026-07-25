import {
  saveMemory,
  searchMemory
} from "./ai/qwenMemory.js";

saveMemory({
  category:
    "investigations",

  title:
    "Outcome Engine Investigation",

  content: `
Subject:
Outcome Engine

Question:
Is OutcomeEngine part of the main pipeline?

Evidence:
evaluatePipeline does not call evaluateOutcome.

Conclusion:
Not proven to be part of the main pipeline.

Confidence:
Medium
`
});

console.log(
  searchMemory(
    "OutcomeEngine"
  )
);
