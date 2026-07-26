import { escapeHtml } from "./layout.js";

// Renders the subset of markdown that arch/templates.js emits, and nothing else.
//
// A general markdown library would be a dependency added to display one file whose
// format this repository controls end to end. The subset is therefore closed and
// listed here: headings, paragraphs, horizontal rules, pipe tables, unordered
// lists, fenced code blocks, inline code, and bold. Anything outside it renders as
// its own literal text rather than being silently dropped — a page that quietly
// swallows a construct is worse than one that shows it, because the omission is
// invisible.
//
// Fenced blocks exist because of a defect this page had on its first render. A
// reproducing command containing `|` was placed in a table cell, and the pipe split
// the cell — so the page displayed a command that would not run. Long commands are
// now their own block, and cell contents are escaped besides.
//
// Everything is escaped before any markup is added. The input is generated here
// today, and a renderer that trusts its input is a renderer that will be handed
// untrusted input eventually.

function inline(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function isTableRow(line) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isDivider(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

// Splits on unescaped pipes only, so a cell may contain `\|`.
function cells(line) {
  const inner = line.trim().slice(1, -1);
  const parts = [];
  let current = "";
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "\\" && inner[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (inner[i] === "|") {
      parts.push(current);
      current = "";
      continue;
    }
    current += inner[i];
  }
  parts.push(current);
  return parts.map((c) => c.trim());
}

/** Markdown to HTML, for the closed subset described above. */
export function renderMarkdown(source) {
  const lines = source.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    if (trimmed === "---") {
      out.push("<hr>");
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const block = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        block.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      out.push(
        `<div class="scroll"><pre><code>${escapeHtml(block.join("\n"))}</code></pre></div>`
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (isTableRow(line)) {
      const header = cells(line);
      let cursor = i + 1;
      const hasDivider = cursor < lines.length && isDivider(lines[cursor]);
      if (hasDivider) cursor += 1;

      const body = [];
      while (cursor < lines.length && isTableRow(lines[cursor])) {
        body.push(cells(lines[cursor]));
        cursor += 1;
      }

      const head = hasDivider
        ? `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`
        : "";
      const rows = (hasDivider ? body : [header, ...body])
        .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("");

      out.push(`<div class="scroll"><table>${head}<tbody>${rows}</tbody></table></div>`);
      i = cursor;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // A paragraph runs until a blank line or the start of another construct, so a
    // sentence wrapped across three source lines renders as one sentence.
    const paragraph = [];
    while (i < lines.length) {
      const current = lines[i];
      const t = current.trim();
      if (t === "" || t === "---" || /^#{1,4}\s/.test(t) || isTableRow(current) || /^[-*]\s+/.test(t)) {
        break;
      }
      paragraph.push(t);
      i += 1;
    }
    out.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return out.join("\n");
}
