import { sweep, WATCHED, SENSOR_VERSION, USER_AGENT } from "./sensor.js";
import { summarise, paths } from "./changes.js";

// node public-site/self/cli.js sweep     one observation of every watched path
// node public-site/self/cli.js report     what the snapshots say so far

const [command] = process.argv.slice(2);

if (command === "sweep") {
  console.log(`${SENSOR_VERSION}  ${USER_AGENT}`);
  const { runId, observations } = await sweep();
  console.log(`run ${runId}\n`);

  for (const o of observations) {
    const outcome = o.errorCode
      ? o.errorCode
      : `${o.httpStatus} ${String(o.bodyBytes).padStart(6)}b  ${o.bodySha256.slice(0, 16)}`;
    console.log(`  ${o.vantage.padEnd(7)} ${o.path.padEnd(14)} ${outcome}`);
  }

  process.exit(0);
}

if (command === "report") {
  const observed = paths();
  if (observed.length === 0) {
    console.log("no sweep has run yet");
    process.exit(0);
  }

  for (const path of observed) {
    const s = summarise(path);
    console.log(`\n=== ${path}`);
    console.log(`  sweeps            ${s.sweeps} (${s.comparableSweeps} with both vantages)`);
    console.log(`  origin != edge    ${s.divergedSweeps}`);
    console.log(
      `  origin changed    ${s.originChanges.length}  volatility ${s.originVolatility.rate ?? "—"}% over ${s.originVolatility.comparisons}`
    );
    console.log(
      `  edge changed      ${s.edgeChanges.length}  volatility ${s.edgeVolatility.rate ?? "—"}% over ${s.edgeVolatility.comparisons}`
    );
    if (s.latestDivergence)
      console.log(
        `  latest difference ${s.latestDivergence.at}  edge ${s.latestDivergence.byteDelta > 0 ? "+" : ""}${s.latestDivergence.byteDelta} bytes`
      );
  }

  process.exit(0);
}

console.log("usage: cli.js sweep | cli.js report");
process.exit(1);
