Subject:
Outcome Engine Investigation

Date:
2026-06-22

Question:
Is OutcomeEngine part of the main pipeline?

Evidence:

grep -R "evaluateOutcome(" .
→ routes/identityRoutes.js
→ routes/analyticsRoutes.js
→ outcomeEngineService.js

grep -R "evaluatePipeline(" .
→ server.js
→ evaluatePipelineService.js

evaluatePipelineService.js
→ createOutcome()
→ does not call evaluateOutcome()

outcomeEngineService.js
→ derives outcome from enforcement.actions
→ does not read events
→ does not read evidence
→ does not read trust assessments

Conclusion:

OutcomeEngine is used by route-level flows.

Evidence was not found showing that
evaluatePipeline directly calls
evaluateOutcome.

Confidence:
Medium

Open Questions:

Does applyTrustUpdate modify
persistent trust state?

Related Files:

src/services/outcomeEngineService.js
src/services/evaluatePipelineService.js
routes/identityRoutes.js
routes/analyticsRoutes.js
