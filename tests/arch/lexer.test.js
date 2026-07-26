import test from "node:test";
import assert from "node:assert/strict";

import {
  stripCommentsAndStrings,
  stripComments,
  isProgramFile
} from "../../arch/scan.js";

// The scanner's lexer had one defect for its entire life and never produced a visibly
// wrong answer from it: a regex literal containing an apostrophe put the walker into a
// string state it stayed in for a hundred and thirty lines, so every comment below that
// point was read as code. It surfaced only when a second consumer of the same function
// started looking for paths, and a doc comment mentioning `Evidence.js` made the tool
// report one of its own modules as reached.
//
// These tests exist because that class of defect is silent. Nothing throws, no figure
// looks strange, and the only symptom is an answer about the wrong text.

test(
  "a regex literal containing quotes does not swallow the code after it",
  () => {

    const source = [
      "const RE = /([A-Za-z_$][\\w$.[\\]'\"]*)\\s*/g;",
      "// a comment",
      "const after = 5;"
    ].join("\n");

    const code =
      stripCommentsAndStrings(
        source
      );

    const lines =
      code.split("\n");

    assert.equal(
      lines.length,
      3,
      "line structure must survive exactly, or findings cite the wrong line"
    );

    assert.match(
      lines[2],
      /const after = 5;/,
      "code below a regex literal must still be code"
    );

    assert.doesNotMatch(
      lines[1],
      /a comment/,
      "the comment below the regex must still be recognised as a comment"
    );
  }
);

test(
  "division is not mistaken for the start of a regex",
  () => {

    const code =
      stripCommentsAndStrings(
        "const half = total / 2;\nconst limit = 90;"
      );

    assert.match(
      code,
      /const limit = 90;/,
      "a division must not consume the rest of the file"
    );
  }
);

test(
  "stripComments keeps string literals and drops comments",
  () => {

    const source = [
      "// see ./ProcessContainer.js",
      "const exec = './ProcessContainer.js';"
    ].join("\n");

    const code =
      stripComments(
        source
      );

    const lines =
      code.split("\n");

    assert.doesNotMatch(
      lines[0],
      /ProcessContainer/,
      "a path named in a comment is documentation, not the program naming a file"
    );

    assert.match(
      lines[1],
      /ProcessContainer\.js/,
      "a path in a string literal is how a file gets loaded without an import"
    );
  }
);

test(
  "stripCommentsAndStrings removes the string a path lives in",
  () => {

    const code =
      stripCommentsAndStrings(
        "const exec = './ProcessContainer.js';"
      );

    assert.doesNotMatch(
      code,
      /ProcessContainer/,
      "the threshold scan must not see string contents"
    );
  }
);

test(
  "both walks preserve line count exactly",
  () => {

    const source = [
      "/* block",
      "   comment */",
      "const a = `template",
      "with a newline`;",
      "// trailing"
    ].join("\n");

    assert.equal(
      stripCommentsAndStrings(source).split("\n").length,
      5
    );

    assert.equal(
      stripComments(source).split("\n").length,
      5
    );
  }
);

test(
  "what counts as a program file is one definition, and it excludes what it claims to",
  () => {

    const kept = [
      "src/services/policyEngineService.js",
      "arch/scan.js",
      "src/index.ts",
      "components/Button.tsx"
    ];

    const dropped = [
      "tests/replay/identityReplay.test.js",
      "test/support/env.js",
      "examples/basic.js",
      "packages/cli/static/skeletons/config.js",
      "dist/bundle.js",
      "types/index.d.ts",
      "node_modules/express/index.js",
      "README.md"
    ];

    for (const path of kept) {
      assert.equal(
        isProgramFile(path),
        true,
        `${path} is part of the program`
      );
    }

    for (const path of dropped) {
      assert.equal(
        isProgramFile(path),
        false,
        `${path} is not part of the program`
      );
    }
  }
);
