import { POPULATION } from "./population.js";
import {
  declareSurvey,
  runSurvey,
  USER_AGENT,
  MIN_INTERVAL_MS,
  MAX_CONCURRENT,
  VANTAGE_POINT
} from "./fetch.js";

// node public-site/survey/cli.js run [n]   fetch the sample, or the first n of it
// node public-site/survey/cli.js declare   print the terms without fetching

const [command, argument] = process.argv.slice(2);

function terms(size) {
  return [
    `population   ${POPULATION.id}  ${POPULATION.url}`,
    `drawn        ${POPULATION.drawnAt}  (${POPULATION.file})`,
    `rule         ${POPULATION.rule}`,
    `sample       ${size} domains`,
    `user agent   ${USER_AGENT}`,
    `rate         one request per domain, ${MIN_INTERVAL_MS} ms apart, ${MAX_CONCURRENT} in flight`,
    `vantage      ${VANTAGE_POINT}`
  ].join("\n");
}

if (command === "declare") {
  console.log(terms(POPULATION.size));
  process.exit(0);
}

if (command !== "run") {
  console.log("usage: cli.js run [n] | cli.js declare");
  process.exit(1);
}

const limit = argument ? Number(argument) : POPULATION.size;
if (!Number.isInteger(limit) || limit < 1 || limit > POPULATION.size) {
  console.error(`n must be between 1 and ${POPULATION.size}`);
  process.exit(1);
}

console.log(terms(limit));
console.log("");

// The declared size is what will actually be attempted, never the size of the
// full sample. A run of eight domains declared as four hundred would describe a
// survey that did not happen.
const surveyId = declareSurvey({ size: limit });
console.log(`survey ${surveyId}\n`);

const started = Date.now();

await runSurvey({
  surveyId,
  limit,
  onProgress({ done, total, target, observation }) {
    const outcome = observation.errorCode
      ? observation.errorCode
      : `${observation.httpStatus}${observation.redirects ? ` after ${observation.redirects}` : ""} ${observation.bodyBytes}b`;
    console.log(
      `${String(done).padStart(4)}/${total}  ${String(target.rank).padStart(6)}  ${target.domain.padEnd(34)} ${outcome}`
    );
  }
});

console.log(`\ndone in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(0);
