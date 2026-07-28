import { setVerification, verificationState } from "./verification.js";

// node public-site/verification-cli.js google <token>
// node public-site/verification-cli.js bing <token>
// node public-site/verification-cli.js state

const [command, token] = process.argv.slice(2);

const NAMES = { google: "google-site-verification", bing: "msvalidate", yandex: "yandex-verification" };

if (command === "state" || !command) {
  for (const s of verificationState())
    console.log(`${s.configured ? "set    " : "not set"}  ${s.console}`);
  process.exit(0);
}

if (!NAMES[command]) {
  console.log("usage: verification-cli.js google|bing|yandex <token> | state");
  process.exit(1);
}

try {
  const key = setVerification(NAMES[command], token);
  console.log(`stored as ${key}`);
  console.log("the tag appears on every page after the next restart");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
