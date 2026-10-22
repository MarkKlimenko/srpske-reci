#!/usr/bin/env node
// Parses the dictionary (Markdown cards) into words.js, which the app loads.
//   node tools/build-words.mjs [language-dir]
// language-dir holds dictionary/ (frequency cards) and themes/ (theme cards); see its DICTIONARY.md.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? join(process.env.HOME, "workplace/my/docs-2/me/serbia/language");
const out = join(here, "..", "words.js");
const FREQ_MAX = 3428;

function stripMarks(s) {
  return s.replace(/\*\*/g, "").replace(/\*/g, "").trim();
}

// Returns the cards of one file in file order, plus its theme header when there is one.
function parseFile(path) {
  const cards = [];
  let cur = null, title = "", meta = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!title && line.startsWith("# ")) { title = line.slice(2).trim(); continue; }
    const m = line.match(/^<!-- theme: (\S+) · block: (.+?) -->$/);
    if (m) { meta = { id: m[1], block: m[2] }; continue; }
    const head = line.match(/^### (\d+)\. (.+?) — (.+)$/);
    if (head) {
      cur = { n: +head[1], sr: head[2].trim(), ru: head[3].trim(), pos: "", forms: "", ex: [], note: "" };
      cards.push(cur);
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
    if (ex) { cur.ex.push([ex[1].trim(), ex[2].trim()]); continue; }
    if (line.startsWith("> ")) cur.note += (cur.note ? "\n" : "") + line.slice(2).trim();
  }
  return { cards, title, meta };
}

const words = new Map();

const dictDir = join(root, "dictionary");
for (const f of readdirSync(dictDir).filter((f) => /^\d{4}-\d{4}\.md$/.test(f)).sort()) {
  for (const c of parseFile(join(dictDir, f)).cards) words.set(c.n, c);
}
for (let n = 1; n <= FREQ_MAX; n++) if (!words.has(n)) throw new Error(`Frequency card ${n} is missing`);

const themes = [];
const themeDir = join(root, "themes");
for (const f of readdirSync(themeDir).filter((f) => /^\d{2}-.+\.md$/.test(f)).sort()) {
  const { cards, title, meta } = parseFile(join(themeDir, f));
  if (!meta) throw new Error(`${f}: no theme header`);
  for (const c of cards) {
    // Frequency words keep their card from dictionary/; theme-only words come from the first theme that has them.
    if (c.n > FREQ_MAX && !words.has(c.n)) words.set(c.n, c);
  }
  themes.push({ id: meta.id, title, block: meta.block, words: cards.map((c) => c.n) });
}

const max = Math.max(...words.keys());
// Compact tuple per word: [sr, ru, pos, forms, examples, note]; the index is n - 1, gaps are null.
const rows = Array.from({ length: max }, (_, i) => {
  const w = words.get(i + 1);
  return w ? [w.sr, w.ru, w.pos, w.forms, w.ex, w.note] : null;
});
const themeRows = themes.map((t) => [t.id, t.title, t.block, t.words]);
writeFileSync(out, "window.WORDS=" + JSON.stringify(rows) + ";\nwindow.THEMES=" + JSON.stringify(themeRows) + ";\n");
console.log(`${words.size} words (max №${max}), ${themes.length} themes → ${out}`);
