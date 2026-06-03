import {
  deriveIntent
} from "./repositories/intentRepository.js";

const signals = [
  "admin_scanning"
];

const intent =
  deriveIntent(signals);

console.log(intent);
