import {
  makeDecision
} from "./repositories/policyRepository.js";

const decision =
  makeDecision({
    trustScore: 30,
    intent: "reconnaissance"
  });

console.log(decision);
