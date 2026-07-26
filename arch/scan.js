import { execFileSync } from "node:child_process";
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import db, { ROOT } from "./db.js";

// Reads the repository and records what is in it. Concludes nothing.
//
// The unit recorded here is a numeric literal on the right of a comparison — a
// threshold, as written, with the expression it is compared against. That is a
// narrow thing to observe on purpose: the first detector above this asks whether
// the same threshold is defined in more than one file, and a scan that recorded
// every token would make that question slower to ask without making it better.
//
// Text, not syntax. There is no JavaScript parser in this project's dependency
// tree, and adding one to answer a single question would be the wrong trade this
// early. So comments and string literals are stripped first — they are where the
// false positives live — and the remainder is matched. This is honest about being
// a lexical approximation, and the limit is real: a threshold built by arithmetic
// (`>= BASE + 20`) or held in a variable is invisible here. Findings say so.
//
// A parser is the upgrade path, and the reason to take it will be a false
// positive this cannot avoid rather than a preference for parsers.

export const SCANNER_VERSION = "scan-16";

// Values that carry no design decision. 0 and 1 are structural, 100 is almost
// always a percentage ceiling, and -1 is a sentinel. A threshold repeated across
// files is only interesting when someone chose the number.
const UNINTERESTING = new Set(["0", "1", "-1", "100"]);

const COMPARISON = /([A-Za-z_$][\w$.[\]'"]*)\s*(>=|<=|===|!==|==|!=|>|<)\s*(\d+(?:\.\d+)?)\b/g;

/**
 * Removes comments, and optionally string literals, preserving line structure.
 *
 * Line count must survive exactly, because a finding that cites the wrong line
 * costs more than one that cites no line: the reader looks, sees something else,
 * and stops trusting the rest of the report.
 *
 * Two callers want two different things from the same walk, and the option exists
 * rather than a second function because "what is a comment" must have exactly one
 * definition here. A threshold inside a comment is documentation; a *path* inside a
 * string is the program naming a file. One of those questions needs strings gone and
 * the other needs them kept, and neither needs its own idea of where a comment ends.
 */
function strip(source, { keepStrings }) {
  let out = "";
  let i = 0;
  const n = source.length;
  let state = "code";
  let quote = "";
  let inClass = false;
  let previous = null;

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line-comment";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "block-comment";
        i += 2;
        continue;
      }
      if (c === "/" && regexCanStartAfter(previous)) {
        state = "regex";
        inClass = false;
        i += 1;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        state = "string";
        quote = c;
        if (keepStrings) out += c;
        i += 1;
        continue;
      }
      out += c;
      if (!/\s/.test(c)) previous = c;
      i += 1;
      continue;
    }

    // regex literal. Skipped like a string, and for the same reason: it is data, not a
    // branch and not a path. Handling it at all was forced by this file — line 32 holds
    // `/([A-Za-z_$][\w$.[\]'"]*)\s*.../g`, whose character class contains a lone
    // apostrophe. Without this branch the walker read that as the start of a string and
    // stayed in it for a hundred and thirty lines, so every comment below it came back
    // as code. That is how a doc comment mentioning `Evidence.js` made this tool report
    // one of its own modules as reached, and it had been true of the threshold scan from
    // the beginning without ever producing a visible wrong answer.
    if (state === "regex") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      // A regex literal cannot contain an unescaped newline. Reaching one means the `/`
      // was division after all, so the walker returns to code rather than swallowing the
      // rest of the file — a wrong guess costs one line instead of everything after it.
      if (c === "\n") {
        state = "code";
        out += "\n";
        i += 1;
        continue;
      }
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) {
        state = "code";
        previous = "/";
        i += 1;
        while (i < n && /[a-z]/.test(source[i])) i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === "line-comment") {
      if (c === "\n") {
        state = "code";
        out += "\n";
      }
      i += 1;
      continue;
    }

    if (state === "block-comment") {
      if (c === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      if (c === "\n") out += "\n";
      i += 1;
      continue;
    }

    // string
    if (c === "\\") {
      if (keepStrings) out += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === quote) {
      state = "code";
      if (keepStrings) out += c;
      i += 1;
      continue;
    }
    if (c === "\n" || keepStrings) out += c;
    i += 1;
  }

  return out;
}

/**
 * Whether a `/` at this point opens a regex literal rather than dividing.
 *
 * Decided from the last significant character, which is what a JavaScript lexer without a
 * parser has to go on. After `=`, `(`, `,`, `[` and the operators, a `/` can only begin a
 * regex; after an identifier, a digit, `)` or `]` it is division.
 *
 * `return /x/.test(s)` is judged wrong by this — the `n` of `return` reads as an
 * identifier — and that is the acceptable direction to be wrong in. Guessing "division"
 * leaves the regex body treated as code, which is what this file did everywhere before
 * this function existed; guessing "regex" wrongly would skip real code.
 */
function regexCanStartAfter(previous) {
  return previous === null || /[=(,[!&|?{};:+\-*~^%<>]/.test(previous);
}

/** Code with comments and string literals gone. What a threshold must be found in. */
export function stripCommentsAndStrings(source) {
  return strip(source, { keepStrings: false });
}

/** Code with comments gone and strings intact. What a file path must be found in. */
export function stripComments(source) {
  return strip(source, { keepStrings: true });
}

/**
 * Whether a match sits inside the header of a `for` loop.
 *
 * Walks back to the nearest `for` on the line and forward to the paren that closes
 * it, so `for (let i = 0; i < 20; i++) if (x > 5)` skips the first comparison and
 * keeps the second. A line-local test, which is enough: a for-header split across
 * lines is rare, and treating a whole line as loop context because it mentions
 * `for` anywhere would hide real thresholds.
 */
function inLoopHeader(line, index) {
  const before = line.slice(0, index);
  const forAt = before.search(/\bfor\s*\($/) >= 0 ? before.search(/\bfor\s*\($/) : before.lastIndexOf("for");
  if (forAt === -1 || !/\bfor\s*\(/.test(before.slice(forAt))) return false;

  let depth = 0;
  for (let i = before.indexOf("(", forAt); i > -1 && i < line.length; i += 1) {
    if (line[i] === "(") depth += 1;
    else if (line[i] === ")") {
      depth -= 1;
      if (depth === 0) return index < i;
    }
  }
  // Unclosed on this line: the match is still inside the header.
  return true;
}

/**
 * Whether a path is part of the program this tool reasons about.
 *
 * Exported because the verifier needs the same answer, and this is the third time the
 * two paths have disagreed over a *definition* rather than over a fact. First it was
 * what counts as code — a threshold quoted in a doc comment. Then which file extensions
 * exist. Now which files are part of the program: git grep found imports of
 * `Evidence.js` in `test-evidence.js`, which the scan excludes, so the scan said four
 * modules were unimported and git said two. Both were right about what they were asked.
 *
 * Independence belongs in the search, never in the vocabulary. One definition, two
 * mechanisms.
 */
/**
 * Every extension this tool reads.
 *
 * It was three, and the list was written out seventeen times across four files. That is
 * how the verifier came to search `*.js` while the scan read `.cjs` too, reported
 * `observed 0` for a finding that was correct, and refused it — the pathspec being
 * narrower than the scan turns every finding outside it into a false refusal.
 *
 * TypeScript is here because leaving it out was the largest thing wrong with this tool.
 * Against etherpad-lite it read 12 files of 1108 and reported nothing, truthfully; against
 * sequelize, 67 of 944. Neither number is a false claim and neither is an audit. Almost
 * every Node codebase somebody would pay to have read is in this list's second half.
 *
 * `.d.ts` is deliberately absent — see NOT_PROGRAM.
 */
export const SOURCE_EXTENSIONS = ["js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx"];

/** The extensions as a regex group: `js|mjs|cjs|...`. */
export const EXTENSION_GROUP = SOURCE_EXTENSIONS.join("|");

/** The extensions as git pathspecs: `*.js`, `*.mjs`, ... */
export const SOURCE_PATHSPEC = SOURCE_EXTENSIONS.map((e) => `*.${e}`);

export const SOURCE_EXTENSION = `\\.(${EXTENSION_GROUP})$`;

/**
 * Everything a source file can be that is not part of the program.
 *
 * Written in the subset of regular-expression syntax that means the same thing to
 * JavaScript and to POSIX extended regular expressions, so the shell commands published
 * inside a finding can filter by the identical rules instead of restating them. That is
 * not a stylistic preference. The published command carried its own hand-written version
 * of these exclusions, it did not know about test files, and it printed 8 next to a
 * published 9 — a reader checking the report would have concluded the report was wrong.
 */
export const NOT_PROGRAM = [
  "node_modules/",
  "\\.(backup|bak|orig|old)(\\.|$)",
  "(^|/)(dist|build|vendor)/",
  "(^|/)(test|tests|__tests__|spec|e2e|benchmarks?)/",
  "\\.(test|spec|smoke)\\.",
  `(^|/)(test|prisma|seed)-[^/]*\\.(${EXTENSION_GROUP})$`,
  // A declaration file describes types and runs nothing. Nothing importing one is the
  // normal case — the compiler finds it by convention — so reporting it as unreached
  // would be the TypeScript equivalent of reporting an example as dead code.
  "\\.d\\.(ts|mts|cts)$",
  // Illustrative rather than part of the program. fastify ships 8 files in
  // `examples/` and winston 25, and every one is standalone by design — an example
  // nothing imports is an example working as intended. Reporting them as dead code
  // is the same error as reporting a test's fixture size as a threshold.
  "(^|/)(examples?|demos?|samples?|fixtures?)/",
  // Files copied into somebody else's project rather than run in this one. sequelize
  // keeps four in `packages/cli/static/skeletons`, and nothing imports a skeleton for
  // the same reason nothing imports an example.
  "(^|/)(skeletons?|templates?|scaffolds?|stubs?|boilerplates?)/"
];

/** The same exclusions as one alternation, for `grep -vE` in a published command. */
export const NOT_PROGRAM_PATTERN = NOT_PROGRAM.join("|");

const sourceRe = new RegExp(SOURCE_EXTENSION);
const configRe = new RegExp(`\\.config\\.(${EXTENSION_GROUP})$`);
const rcRe = new RegExp(`^\\.[\\w.-]*rc\\.(${EXTENSION_GROUP})$`);
const notProgramRe = new RegExp(NOT_PROGRAM_PATTERN);

export function isProgramFile(p) {
  return sourceRe.test(p) && !notProgramRe.test(p);
}

/**
 * Files git tracks that are part of the program, via the one definition of that.
 *
 * This function used to hold its own copy of the rules while `isProgramFile` held
 * another, which is the fifth time this tool has grown two definitions of one word —
 * and the first time it happened inside a change made to stop it happening. Adding
 * `examples/` to `isProgramFile` therefore had no effect on the scan, and fastify's
 * eight example files kept coming back as dead code.
 *
 * There is nothing subtle about the failure. It is what a duplicated rule always does,
 * which is why this tool exists.
 */
function trackedSourceFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter(isProgramFile);
}

/**
 * Files that are meant to be run rather than imported.
 *
 * The unimported-module detector is worthless without this. Its first measurement on
 * agentshield named 50 files, and a third of them were command-line tools, config
 * files and one-off scripts: nothing imports a CLI, and saying so is true and useless.
 *
 * Every signal here is a declaration rather than a guess. A shebang is a file saying "run
 * me". A path in a manifest is the project saying it — see `manifestDeclarations`, which
 * reads all of them rather than a list of keys somebody thought of. A `*.config.js` or
 * `.somethingrc.js` name is the ecosystem's convention, read by tools that require the
 * file themselves. And a file at the root whose name is a declared dependency belongs to
 * that dependency: sequelize keeps `typedoc.js` beside a `typedoc` devDependency, and the
 * tool reported it and `.eslintrc.js` as dead code.
 *
 * Note what the last signal is not. It is not "this filename looks like a config" — it
 * is the project's own package.json saying the name refers to a tool it installed.
 * Anything relying on a hunch about the filename stays out.
 */
/** Every package name this project declares it depends on, of any kind. */
function declaredDependencies() {
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    return new Set(
      ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
        .flatMap((field) => Object.keys(pkg[field] ?? {}))
    );
  } catch {
    return new Set();
  }
}

function entryPoints(files) {
  const entries = new Set();
  const declared = declaredDependencies();

  for (const rel of files) {
    if (/(^|\/)bin\//.test(rel)) entries.add(rel);
    if (configRe.test(rel)) entries.add(rel);
    if (rcRe.test(rel)) entries.add(rel);
    // Root level only. Deeper down, a file sharing a package's name is far more likely
    // to be a module about that package than the package's own configuration.
    if (!rel.includes("/") && declared.has(rel.replace(sourceRe, ""))) entries.add(rel);
    try {
      const fd = openSync(join(ROOT, rel), "r");
      const head = Buffer.alloc(2);
      readSync(fd, head, 0, 2, 0);
      closeSync(fd);
      if (head.toString("utf8") === "#!") entries.add(rel);
    } catch {
      // Unreadable is not an entry point; the scan skips it later anyway.
    }
  }

  const { paths, directories, commands } = manifestDeclarations();

  for (const rel of files) {
    if (paths.has(rel)) entries.add(rel);
    // Anywhere beneath a declared directory, not only directly inside it. oclif's command
    // directory nests: sequelize keeps its migration subcommands in
    // `_commands/migration/`, and matching only the immediate parent left all four of them
    // reported as dead code by a change made to stop exactly that.
    if ([...directories].some((d) => rel.startsWith(`${d}/`))) entries.add(rel);
    // Script bodies are command lines, not paths, so the file has to be looked for
    // inside them. `"start": "node server.js"` names server.js and nothing resolves it.
    if (commands.includes(rel)) entries.add(rel);
  }

  return entries;
}

/** Every string anywhere in a parsed manifest, at any depth. */
function everyString(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) everyString(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) everyString(v, out);
  return out;
}

/** A string that could be a path: no whitespace, and a slash or an extension in it. */
function looksLikePath(text) {
  return !/\s/.test(text) && (text.includes("/") || /\.[a-z]+$/.test(text));
}

// Keys npm defines itself. Everything else at the top level of a package.json belongs to
// some tool that reads it — `oclif`, `jest`, `nodemon`, `c8` — and a path inside one of
// those blocks is that tool being told where to find things to load.
//
// The distinction is not decoration. Reading *every* key found sequelize's oclif commands
// and also found express's `"files": ["lib/"]`, which is a publish manifest: it says which
// files go into the npm tarball and nothing about what loads them. Honouring it marked all
// seven of express's program files as entry points and silenced the detector for that
// repository completely — the failure this function's own comment had warned about, one
// paragraph above the code that caused it.
//
// So npm's keys are read by name, because their meanings are known, and only the ones that
// genuinely name an entry point are used. Unknown keys are read whole, because a tool's
// configuration block is exactly where a loader declaration lives and no list of key names
// would have contained `oclif.commands`.
const NPM_KEYS = new Set([
  "name", "version", "description", "keywords", "homepage", "bugs", "license", "author",
  "contributors", "funding", "files", "man", "directories", "repository", "config",
  "dependencies", "devDependencies", "peerDependencies", "peerDependenciesMeta",
  "bundledDependencies", "bundleDependencies", "optionalDependencies", "overrides",
  "resolutions", "engines", "devEngines", "os", "cpu", "private", "publishConfig",
  "workspaces", "type", "types", "typings", "sideEffects", "packageManager", "scripts"
]);

// npm keys that do name something meant to be loaded rather than imported by a sibling.
const NPM_ENTRY_KEYS = ["main", "module", "browser", "bin", "exports", "imports"];

/**
 * Paths the project's own manifests declare, mapped back to source.
 *
 * `main`, `bin` and `scripts` were read by name, which found the three declarations this
 * repository happens to make and missed the one sequelize makes:
 *
 *     "oclif": { "commands": "./lib/_commands" }
 *
 * oclif loads every file in that directory as a subcommand. Nothing imports them, nothing
 * writes their names down, and the tool reported four of them as dead code.
 *
 * Two things keep the wider reading from being reckless. A string only counts if it
 * resolves to something git tracks. And `./lib/_commands` resolves to nothing, because
 * `lib` is build output — so the sibling `tsconfig.json` is read for `outDir` and
 * `rootDir`, and the path is mapped back through them. That mapping is a declaration too;
 * nothing here guesses that `lib` means `src`.
 *
 * A declaration naming the source root itself is still dropped, as a second guard.
 */
function manifestDeclarations() {
  const paths = new Set();
  const directories = new Set();
  const commands = [];

  let manifests;
  try {
    manifests = execFileSync("git", ["ls-files", "-z", "package.json", "*/package.json"], {
      cwd: ROOT,
      encoding: "utf8"
    })
      .split("\0")
      .filter((p) => p && !p.includes("node_modules/"));
  } catch {
    return { paths, directories, commands };
  }

  const tracked = new Set(
    execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
      .split("\0")
      .filter(Boolean)
  );
  const trackedDirectories = new Set();
  for (const file of tracked) {
    let at = file.lastIndexOf("/");
    while (at > -1) {
      trackedDirectories.add(file.slice(0, at));
      at = file.lastIndexOf("/", at - 1);
    }
  }

  for (const manifest of manifests) {
    const base = manifest.slice(0, Math.max(0, manifest.lastIndexOf("/")));
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(ROOT, manifest), "utf8"));
    } catch {
      continue;
    }

    commands.push(Object.values(pkg.scripts ?? {}).join(" "));

    const { outDir, rootDir } = buildLayout(base);
    const sourceRoot = rootDir ? joinRel(base, rootDir) : null;

    // Node's implicit rule when a package declares no entry at all: `index.js` beside the
    // manifest. express relies on it — it has no `main`, no `exports`, and lists
    // `index.js` only under `files`, which is a publish manifest and says nothing about
    // loading. Without this the package's own front door reads as dead code.
    const declaresEntry = NPM_ENTRY_KEYS.some((key) => pkg[key] !== undefined);
    const implicit = declaresEntry ? [] : SOURCE_EXTENSIONS.map((e) => `index.${e}`);

    const declaredHere = [
      ...implicit,
      ...NPM_ENTRY_KEYS.flatMap((key) => everyString(pkg[key] ?? null)),
      ...Object.entries(pkg)
        .filter(([key]) => !NPM_KEYS.has(key) && !NPM_ENTRY_KEYS.includes(key))
        .flatMap(([, value]) => everyString(value))
    ];

    for (const text of declaredHere) {
      if (!looksLikePath(text)) continue;
      for (const candidate of underSource(joinRel(base, text), outDir && joinRel(base, outDir), sourceRoot)) {
        if (candidate === sourceRoot || candidate === base) continue;
        if (tracked.has(candidate)) paths.add(candidate);
        // A declared directory that holds every program file this package has says nothing
        // discriminating: honouring it would mark the whole package as entry points and
        // switch the detector off. `"nodemonConfig": { "watch": ["src"] }` is that shape,
        // and so is any `outDir` in a project with no tsconfig to recognise it by. Exact
        // rather than a proportion — a threshold here would be a guess about how much of a
        // package a loader may plausibly own, and there is no such number.
        else if (trackedDirectories.has(candidate) && !coversWholePackage(candidate, base, tracked)) {
          directories.add(candidate);
        }
      }
    }
  }

  return { paths, directories, commands: commands.join(" ") };
}

/**
 * Whether a directory holds every program file belonging to this package.
 *
 * "Belonging to" stops at the next manifest down, which matters in a monorepo: the root
 * package of a workspace contains every package's files, and a directory of the root is
 * not the whole of it.
 */
function coversWholePackage(directory, base, tracked) {
  const prefix = base ? `${base}/` : "";
  let inPackage = 0;
  let inDirectory = 0;

  for (const file of tracked) {
    if (!file.startsWith(prefix) || !isProgramFile(file)) continue;
    inPackage += 1;
    if (file.startsWith(`${directory}/`)) inDirectory += 1;
  }

  return inPackage > 0 && inDirectory === inPackage;
}

/** `outDir` and `rootDir` from the tsconfig.json beside a manifest, if it declares them. */
function buildLayout(base) {
  try {
    const raw = readFileSync(join(ROOT, base ? `${base}/tsconfig.json` : "tsconfig.json"), "utf8");
    // Comments are legal in tsconfig.json and JSON.parse rejects them.
    const config = JSON.parse(stripComments(raw));
    return {
      outDir: config.compilerOptions?.outDir ?? null,
      rootDir: config.compilerOptions?.rootDir ?? null
    };
  } catch {
    return { outDir: null, rootDir: null };
  }
}

/** A declared path, plus the same path with the build directory swapped for the source. */
function underSource(declared, outDir, sourceRoot) {
  const out = [declared];
  if (outDir && sourceRoot && (declared === outDir || declared.startsWith(`${outDir}/`))) {
    const tail = declared.slice(outDir.length);
    const mapped = `${sourceRoot}${tail}`;
    out.push(mapped);
    // A declaration written against build output names the compiled extension. The
    // source it came from does not have it.
    for (const extension of SOURCE_EXTENSIONS) {
      out.push(mapped.replace(/\.(js|mjs|cjs)$/, `.${extension}`));
    }
  }
  return out;
}

/** Normalises `base` + `./relative` into a repository-relative path. */
function joinRel(base, relative) {
  const cleaned = relative.replace(/^\.\//, "").replace(/^\//, "").replace(/\/$/, "");
  const combined = base ? `${base}/${cleaned}` : cleaned;
  return combined.split("/").filter((s) => s && s !== ".").join("/");
}

/**
 * Every module specifier imported or required by a file, with where it points.
 *
 * Recorded as observation, not as a conclusion. A row says "this file, at this line,
 * names this specifier, which resolves to this path" — whether anything is wrong with
 * that is a question for the layer above, and one that has to stay answerable by
 * re-reading these rows.
 *
 * Only relative specifiers are resolved. A bare `fastify` is a package and not a file
 * in this repository, so it is recorded with no resolution rather than guessed at.
 */
// A quoted specifier reached from an import keyword, with anything in between.
//
// The first version required the quote to follow `require(` immediately, and went blind
// on the pattern project-anchor uses everywhere:
// `require(path.join(rootDir, 'src/extraction/extract-generic.js'))`. Five modules came
// back as imported by nothing when `bin/ingest.js` loads all five, and the verifier
// refused the finding. Plugin loaders and CLI dispatchers compute paths like this
// routinely, so it is the normal case rather than an oddity.
//
// Nothing between the keyword and the quote may itself be a quote, which keeps the match
// on one specifier instead of running across two.
const IMPORT = /\b(?:from|import|require)\b[^"'\n]*["']([^"']+)["']/g;

function resolveSpecifier(fromRel, specifier, fileSet) {
  // A specifier that starts with a dot is relative to the importing file. One that looks
  // like a repository path — `src/extraction/extract-generic.js` — is what a computed
  // require leaves behind once `path.join(rootDir, ...)` is stripped away, and resolving
  // it from the root is the only way to see those edges. A bare `fastify` is a package
  // and matches neither, so it resolves to nothing rather than being guessed at.
  const looksRootRelative = /^[a-zA-Z0-9_@][\w@./-]*\/[^/]/.test(specifier);
  if (!specifier.startsWith(".") && !looksRootRelative) return null;

  const base = specifier.startsWith(".") ? join(dirname(fromRel), specifier) : specifier;
  const normalised = base.split("/").filter((seg) => seg !== ".").join("/");

  // TypeScript's rule, which is the one that matters here: under NodeNext a specifier
  // ending in `.js` resolves to the `.ts` file beside it, because the extension names the
  // *output*. `import { x } from './parser.js'` in a repository containing only
  // `parser.ts` is correct code, and a resolver that only tries the literal extension
  // sees nothing — which would report most of a TypeScript codebase as unreachable and be
  // wrong about every one.
  const withoutJsSuffix = normalised.replace(/\.(js|mjs|cjs)$/, "");

  const candidates = [
    normalised,
    ...SOURCE_EXTENSIONS.map((e) => `${normalised}.${e}`),
    ...SOURCE_EXTENSIONS.map((e) => `${withoutJsSuffix}.${e}`),
    ...SOURCE_EXTENSIONS.map((e) => `${normalised}/index.${e}`)
  ];

  for (const candidate of candidates) {
    const cleaned = candidate.replace(/^\.\//, "");
    if (fileSet.has(cleaned)) return cleaned;
  }
  return null;
}

// Any quoted string. Read from code with comments removed and strings intact, so a
// path mentioned in prose above the function does not count as the program naming it.
const STRING_LITERAL = /["'`]([^"'`\n]*)["'`]/g;

// A path segment with nothing computed in it. `${dir}` is not one; `ProcessContainer.js`
// is. Used to find the plain tail of a literal — see `filesNamedBy`.
const PLAIN_SEGMENT = /^[\w.@-]+$/;

/**
 * Which tracked files a string literal could be naming.
 *
 * `resolveSpecifier` answers where an import points, and it is the wrong tool for this
 * question. pm2 starts four of its own modules with
 * `path.resolve(path.dirname(module.filename), 'ProcessContainer.js')` and hands the
 * result to `child_process.fork`. There is no import keyword, the specifier is a bare
 * basename that resolves relative to nothing, and all four files came back as reached by
 * nothing — a false positive on every one, in the most-downloaded process manager in the
 * ecosystem.
 *
 * So the question asked here is deliberately weaker and answerable: does the program
 * write this file's name down anywhere. `fork`, `spawn`, `new Worker`, an `execArgv`, a
 * plugin table of paths — all of them name the file, and none of them import it.
 *
 * The literal's longest *plain* trailing run of segments is matched against the end of
 * each tracked path at a segment boundary. `` `${root}/lib/x.js` `` therefore matches
 * `lib/x.js`, `'./x.js'` matches any `x.js`, and `'src/a/b.js'` must match that whole
 * tail rather than any `b.js`. Ambiguity resolves outward: a literal naming `index.js`
 * marks every `index.js` as named. That direction is chosen on purpose — the cost of
 * being too generous is a dead module this tool stays quiet about, and the cost of being
 * too strict is telling somebody their running code is dead.
 */
function filesNamedBy(literal, filesByTail) {
  // A path has no spaces in it. A command does. `tools/repo-analyst.js` contains the
  // string "git log -- src/services/outcomeEngineService.js", and counting that as the
  // program loading the file silenced a genuine finding — the module documented in
  // SYSTEM_OF_RECORD.md that nothing runs. Naming a file *to* a subprocess as an argument
  // is the opposite of loading it, and the whitespace tells the two apart at no cost.
  if (/\s/.test(literal)) return [];

  const segments = literal.trim().split("/");
  const tail = [];
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (!PLAIN_SEGMENT.test(segments[i])) break;
    tail.unshift(segments[i]);
  }
  if (tail.length === 0) return [];
  if (!sourceRe.test(tail[tail.length - 1])) return [];

  // Longest tail first: the literal claims as much of the path as it plainly states,
  // and a shorter match would widen a specific reference into a vague one.
  for (let start = 0; start < tail.length; start += 1) {
    const key = tail.slice(start).join("/");
    const hit = filesByTail.get(key);
    if (hit) return hit;
  }
  return [];
}

/** Every tracked file indexed by each of its path suffixes, at segment boundaries. */
function indexByTail(files) {
  const index = new Map();
  for (const rel of files) {
    const segments = rel.split("/");
    for (let start = 0; start < segments.length; start += 1) {
      const key = segments.slice(start).join("/");
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(rel);
    }
  }
  return index;
}

function head() {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const at = execFileSync("git", ["log", "-1", "--format=%aI", sha], {
    cwd: ROOT,
    encoding: "utf8"
  }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  return { sha, at, dirty: status.trim().length > 0 ? 1 : 0 };
}

const insertScan = db.prepare(`
  INSERT INTO RepoScan (
    id, commitSha, commitAt, dirty, scannedAt, scannedAtMs, fileCount, scannerVersion
  ) VALUES (@id, @commitSha, @commitAt, @dirty, @scannedAt, @scannedAtMs, @fileCount, @scannerVersion)
`);

const insertRow = db.prepare(`
  INSERT INTO RepoReality (
    id, scanId, kind, filePath, line, subject, operator, value, sourceLine, resolvesTo
  ) VALUES (
    @id, @scanId, @kind, @filePath, @line, @subject, @operator, @value, @sourceLine, @resolvesTo
  )
`);

/**
 * Records one scan of the working tree and returns its id.
 *
 * Rows are never updated. A second scan is a second set of rows against a new
 * scan id, so what the repository looked like at each point stays readable — the
 * whole reason a detector above this can say when something started.
 */
export function scanRepository({ verbose = false } = {}) {
  const { sha, at, dirty } = head();
  const files = trackedSourceFiles();
  const fileSet = new Set(files);
  const filesByTail = indexByTail(files);
  const entries = entryPoints(files);
  const scanId = randomUUID();
  const now = new Date();

  const rows = [];

  for (const relPath of files) {
    // One row per module, so the layer above can ask about a file that contains
    // nothing else of interest. `subject` carries how the file declares itself
    // runnable, which is a fact about the file and not a judgement about it.
    rows.push({
      id: randomUUID(),
      scanId,
      kind: "module",
      filePath: relPath,
      line: 0,
      subject: entries.has(relPath) ? "entry_point" : "module",
      operator: null,
      value: relPath,
      sourceLine: relPath,
      resolvesTo: null
    });
  }

  for (const relPath of files) {
    const abs = join(ROOT, relPath);
    let source;
    try {
      if (statSync(abs).size > 2_000_000) continue;
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    const cleaned = stripCommentsAndStrings(source);
    const originalLines = source.split("\n");
    const lines = cleaned.split("\n");
    // Comments gone, strings kept. Everything below that looks for a path looks here,
    // which replaced a gate that tested the stripped line for an import keyword and then
    // read the original: that let a commented-out `require('./x')` count whenever it
    // shared a line with live code.
    const codeLines = stripComments(source).split("\n");

    for (let n = 0; n < lines.length; n += 1) {
      COMPARISON.lastIndex = 0;
      let match;
      while ((match = COMPARISON.exec(lines[n])) !== null) {
        const [, subject, operator, value] = match;
        if (UNINTERESTING.has(value)) continue;
        // A loop bound is not a threshold. `for (var i = 0; i < 6000; i++)` says how
        // many times to go round, not what the program decides at 6000, and express
        // repeats that exact line in four files. Skipped by position rather than by
        // subject name, because the problem is the construct and not the variable —
        // a real threshold can be called `i` and a loop counter can be called
        // `retryAttempt`.
        if (inLoopHeader(lines[n], match.index)) continue;
        rows.push({
          id: randomUUID(),
          scanId,
          kind: "threshold_comparison",
          filePath: relPath,
          line: n + 1,
          subject,
          operator,
          value,
          sourceLine: (originalLines[n] ?? "").trim().slice(0, 300),
          resolvesTo: null
        });
      }

      // Read from the comment-free line, not the stripped one. An import specifier *is*
      // a string literal, so `stripCommentsAndStrings` deletes exactly the thing this
      // is looking for — the first version of this recorded zero imports in a repo
      // with hundreds.
      const codeLine = codeLines[n] ?? "";

      IMPORT.lastIndex = 0;
      let imp;
      while ((imp = IMPORT.exec(codeLine)) !== null) {
        const specifier = imp[1];
        rows.push({
          id: randomUUID(),
          scanId,
          kind: "import",
          filePath: relPath,
          line: n + 1,
          subject: specifier,
          operator: null,
          value: specifier,
          sourceLine: (originalLines[n] ?? "").trim().slice(0, 300),
          resolvesTo: resolveSpecifier(relPath, specifier, fileSet)
        });
      }

      // Every file this line names, however it names it. Separate from the import rows
      // on purpose: "an import points here" and "the program writes this name down" are
      // different facts, and a detector that needs the second one must not have to
      // pretend it found the first.
      STRING_LITERAL.lastIndex = 0;
      let lit;
      while ((lit = STRING_LITERAL.exec(codeLine)) !== null) {
        for (const named of filesNamedBy(lit[1], filesByTail)) {
          if (named === relPath) continue;
          rows.push({
            id: randomUUID(),
            scanId,
            kind: "path_literal",
            filePath: relPath,
            line: n + 1,
            subject: lit[1],
            operator: null,
            value: lit[1],
            sourceLine: (originalLines[n] ?? "").trim().slice(0, 300),
            resolvesTo: named
          });
        }
      }
    }
  }

  const write = db.transaction(() => {
    insertScan.run({
      id: scanId,
      commitSha: sha,
      commitAt: at,
      dirty,
      scannedAt: now.toISOString(),
      scannedAtMs: now.getTime(),
      fileCount: files.length,
      scannerVersion: SCANNER_VERSION
    });
    for (const row of rows) insertRow.run(row);
  });
  write();

  if (verbose) {
    console.log(
      `[scan] ${sha.slice(0, 8)}${dirty ? " (dirty)" : ""} · ${files.length} file(s) · ` +
        `${rows.filter((r) => r.kind === "threshold_comparison").length} threshold(s) · ` +
        `${rows.filter((r) => r.kind === "import").length} import(s) · ${entries.size} entry point(s)`
    );
  }

  return {
    scanId,
    commitSha: sha,
    dirty,
    fileCount: files.length,
    thresholdCount: rows.filter((r) => r.kind === "threshold_comparison").length,
    importCount: rows.filter((r) => r.kind === "import").length,
    entryPointCount: entries.size
  };
}

export function latestScan() {
  return db
    .prepare("SELECT * FROM RepoScan ORDER BY scannedAtMs DESC LIMIT 1")
    .get();
}

/**
 * What share of the repository this tool is able to read.
 *
 * A report of "0 findings" is the most dangerous output this tool can produce, because it
 * reads as a clean bill of health and is indistinguishable from a tool that was not
 * looking. Before TypeScript was added, this read 12 files of etherpad-lite's 1108 and
 * reported nothing, truthfully. It now reads 299 and finds six things.
 *
 * The counting stayed after the cause was fixed, and should. The next repository will be
 * mostly Python, or Rust, or a monorepo where the Node part is a tenth of the tree, and
 * the ratio is what tells a reader which kind of zero they are looking at. Not a caveat
 * in a footer: the numerator and denominator, where the finding count is.
 */
export function coverage() {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);

  const read = tracked.filter(isProgramFile);
  const source = tracked.filter((p) => sourceRe.test(p));

  return {
    read: read.length,
    source: source.length,
    tracked: tracked.length,
    excludedSource: source.length - read.length
  };
}
