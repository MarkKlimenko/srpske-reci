#!/usr/bin/env node
// Parses the frequency dictionary (Markdown) into words.js, which the app loads.
//   node tools/build-words.mjs [dictionary-dir]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] ?? join(process.env.HOME, "workplace/my/docs-2/me/serbia/language/dictionary");
const out = join(here, "..", "words.js");

const files = readdirSync(dir).filter((f) => /^\d{4}-\d{4}\.md$/.test(f)).sort();
const words = [];
let cur = null;

function stripMarks(s) {
  return s.replace(/\*\*/g, "").replace(/\*/g, "").trim();
}

for (const file of files) {
  for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
    const head = line.match(/^### (\d+)\. (.+?) — (.+)$/);
    if (head) {
      cur = { n: +head[1], sr: head[2].trim(), ru: head[3].trim(), pos: "", forms: "", ex: [], note: "" };
      words.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^\*[^*]/.test(line) && !cur.pos) {
      const [pos, ...rest] = line.split(" · ");
      cur.pos = stripMarks(pos);
      cur.forms = stripMarks(rest.join(" · ")).replace(/^формы:\s*/, "");
      continue;
    }
    const ex = line.match(/^- \*(.+?)\* — (.+)$/);
    if (ex) {
      cur.ex.push([ex[1].trim(), ex[2].trim()]);
      continue;
    }
    if (line.startsWith("> ")) cur.note += (cur.note ? "\n" : "") + line.slice(2).trim();
  }
}

words.sort((a, b) => a.n - b.n);
words.forEach((w, i) => {
  if (w.n !== i + 1) throw new Error(`Gap in numbering near ${w.n}`);
});

// Compact tuple per word: [sr, ru, pos, forms, examples, note]; the index is n - 1.
const rows = words.map((w) => [w.sr, w.ru, w.pos, w.forms, w.ex, w.note]);
writeFileSync(out, "window.WORDS=" + JSON.stringify(rows) + ";\n");
console.log(`${words.length} words → ${out}`);
