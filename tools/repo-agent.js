import { execSync } from "node:child_process";

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10
    });
  } catch (e) {
    return "";
  }
}

const target =
  process.argv[2];

if (!target) {
  console.log(
    'Usage: node tools/repo-agent.js outcomeEngineService'
  );
  process.exit(1);
}

console.log("\n=== SEARCHING ===\n");

const references =
  run(
    `grep -R "${target}" .`
  );

const filePath =
  run(
    `find . -name "${target}.js"`
  ).trim();

const fileContent =
  filePath
    ? run(`cat "${filePath}"`)
    : "FILE NOT FOUND";

const gitHistory =
  filePath
    ? run(
        `git log --oneline -- "${filePath}"`
      )
    : "";

const prompt = `
You are a repository analyst.

Rules:

1. Separate evidence from conclusions.
2. Never invent files.
3. Never invent history.
4. If evidence is insufficient say:
   "insufficient evidence".

Target:
${target}

FILE PATH:
${filePath}

FILE CONTENT:
${fileContent}

REFERENCES:
${references}

GIT HISTORY:
${gitHistory}

Answer:

1. Evidence
2. Conclusions
3. Confidence
4. Can this file be removed safely?
`;

const escaped =
  prompt
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");

const answer =
  run(
    `ollama run qwen3:8b "${escaped}"`
  );

console.log(answer);
