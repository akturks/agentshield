import {
  deriveIntent
} from "./src/services/intentDerivationService.js";

const signals = [
  "admin_scanning"
];

const intent =
  deriveIntent(signals);

console.log(intent);
