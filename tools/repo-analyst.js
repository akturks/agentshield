import { execSync } from "node:child_process";

const question =
  process.argv.slice(2).join(" ");

if (!question) {
  console.log(
    "Usage: node tools/repo-analyst.js \"question\""
  );
  process.exit(1);
}

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20
    });
  } catch {
    return "";
  }
}

const files =
  run(
    "find . -name '*.js' -o -name '*.md'"
  );

const imports =
  run(
    "grep -R \"outcomeEngineService\" ."
  );

const gitHistory =
  run(
    "git log -- src/services/outcomeEngineService.js"
  );

const prompt = `
You are a repository analyst.

Question:
${question}

Repository Files:
${files}

Import References:
${imports}

Git History:
${gitHistory}

Rules:

1. Separate Evidence from Assumptions.
2. Never invent facts.
3. Show evidence first.
4. Then conclusions.
`;

const escaped =
  prompt.replace(
    /"/g,
    '\\"'
  );

const answer =
  run(
    `ollama run qwen3:8b "${escaped}"`
  );

console.log(answer);
