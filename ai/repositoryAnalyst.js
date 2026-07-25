import { execSync } from "node:child_process";

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20
    });
  } catch (error) {
    return String(error);
  }
}

export function analyze(question) {

  const outcomeReferences =
    run("grep -R 'evaluateOutcome(' .");

  const feedbackReferences =
    run("grep -R 'generateFeedback(' .");

  const pipeline =
    run("cat src/services/evaluatePipelineService.js");

  const prompt = `
You are an evidence-first repository analyst.

Rules:
- Never invent files.
- Never invent history.
- Separate Evidence from Conclusions.
- If evidence is missing, say "insufficient evidence".

Question:
${question}

Evidence:

=== evaluateOutcome References ===
${outcomeReferences}

=== generateFeedback References ===
${feedbackReferences}

=== Main Pipeline ===
${pipeline}

Answer in this format:

EVIDENCE:
...

CONCLUSIONS:
...

CONFIDENCE:
...
`;

  const escaped =
    prompt
      .replace(/"/g, '\\"')
      .replace(/\n/g, " ");

  return run(
    `ollama run qwen3:8b "${escaped}"`
  );
}
