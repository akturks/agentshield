import {
  generateObservations
} from "./src/services/observationGenerationService.js";

console.log(
  JSON.stringify(
    generateObservations(),
    null,
    2
  )
);
