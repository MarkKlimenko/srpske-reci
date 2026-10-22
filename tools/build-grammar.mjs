#!/usr/bin/env node
// Builds grammar.js (lessons, cheat sheet, exercises) from the Markdown grammar course.
//   node tools/build-grammar.mjs [language-dir]
// language-dir holds grammar.md (plan with levels), grammar/NN-*.md (lessons) and cheatsheet.md.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? join(process.env.HOME, "workplace/my/docs-2/me/serbia/language");
const out = join(here, "..", "grammar.js");

/* ---------- Markdown to HTML (the subset the course uses) ---------- */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<i>$2</i>");
}

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function md(text, shift = 0) {
  const lines = text.split("\n");
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,6}) (.+)$/);
    if (h) {
      const lvl = Math.min(6, h[1].length + shift);
      html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) { html.push("<hr>"); i++; continue; }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const head = splitRow(rows[0]);
      const body = rows.slice(/^\|[\s:|-]+\|?\s*$/.test(rows[1] || "") ? 2 : 1).map(splitRow);
      html.push('<div class="tbl"><table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      html.push("<ul>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ul>");
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      html.push("<ol>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ol>");
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6} |\||- |\d+\. |---)/.test(lines[i])) para.push(lines[i++]);
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return html.join("\n");
}

/* ---------- Exercises ---------- */

// Splits a "## ..." part into "### ..." chunks: [{ head, body }].
function chunks(text) {
  return text.split(/^### /m).slice(1).map((c) => {
    const nl = c.indexOf("\n");
    return { head: c.slice(0, nl).trim(), body: c.slice(nl + 1) };
  });
}
const exNumber = (head) => (head.match(/(\d+)/) || [])[1];
const strip = (s) => s.replace(/\*/g, "").trim();
const clean = (s) => strip(s).replace(/\s*\([^)]*\)/g, "").trim();

// The option the answer names as a whole word; the longest one wins ("dok ne" over "dok").
function pickOption(options, answer) {
  const a = clean(answer).toLowerCase();
  const hits = options.filter((o) => new RegExp("(^|[^\\p{L}])" + o.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\p{L}]|$)", "u").test(a));
  return hits.sort((x, y) => y.length - x.length)[0] ?? null;
}

// Types: "choice" (buttons), "gap" (type into blanks), "short" (type a short answer),
// "self" (write, compare with the sample, judge yourself), "open" (no answer), "text" (shown as is).
function parseExercise(head, body, answerBody) {
  const title = head.replace(/^Упражнение\s+/i, "").trim();
  const lines = body.split("\n");
  const items = [], intro = [];
  for (const l of lines) {
    const m = l.match(/^(\d+)\. (.*)$/);
    if (m) items.push(m[2]);
    else if (l.trim() && !items.length) intro.push(l);
  }
  const answers = answerBody ? answerBody.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => strip(l.replace(/^\d+\. /, ""))) : [];
  const low = title.toLowerCase();
  const base = { title: inline(title), intro: md(intro.join("\n")) };

  if (!answers.length || /о себе|открыт/.test(low)) return { ...base, type: "open", items: items.map(inline) };
  if (answers.length !== items.length) return { ...base, type: "text", html: md(items.map((t, k) => `${k + 1}. ${t}`).join("\n")), answers: md(answers.map((t, k) => `${k + 1}. ${t}`).join("\n")) };
  if (/перевед|перевод/.test(low)) return { ...base, type: "self", items: items.map((t, k) => ({ q: inline(t), a: inline(answers[k]) })) };

  const orHead = title.match(/(?:^|\d\.\s*)([^\s,]+) или ([^\s,]+)/);
  const out = [];
  let kind = null;
  for (let k = 0; k < items.length; k++) {
    const q = items[k], a = answers[k];
    const opt = q.match(/\(([^()]+ \/ [^()]+)\)/);
    if (opt) {
      const options = opt[1].split(" / ").map((s) => strip(s));
      const right = pickOption(options, a);
      if (right === null) { kind = "self"; break; }
      out.push({ q: inline(q.replace(opt[0], "( … )")), options, right, a });
      kind = kind ?? "choice";
      continue;
    }
    if (orHead && /___/.test(q)) {
      const options = [orHead[1], orHead[2]].map(strip);
      const right = pickOption(options, a.split(/[\s,]+/)[0]);
      if (right === null) { kind = "self"; break; }
      out.push({ q: inline(q), options, right, a });
      kind = kind ?? "choice";
      continue;
    }
    if (/___/.test(q)) {
      const gaps = (q.match(/___+/g) || []).length;
      const parts = gaps === 1 ? [clean(a)] : clean(a).split(/\s+—\s+|,\s+/);
      if (parts.length !== gaps) { kind = "self"; break; }
      out.push({ q: inline(q).split(/___+/), a: parts, full: a });
      kind = kind ?? "gap";
      continue;
    }
    if (clean(a).split(/\s+/).length <= 4) { out.push({ q: inline(q), a: [clean(a)], full: a }); kind = kind === "gap" ? "gap" : (kind ?? "short"); continue; }
    kind = "self";
    break;
  }
  if (kind === "self" || !kind) return { ...base, type: "self", items: items.map((t, k) => ({ q: inline(t), a: inline(answers[k]) })) };
  if (kind === "choice" && out.some((o) => !o.options)) return { ...base, type: "self", items: items.map((t, k) => ({ q: inline(t), a: inline(answers[k]) })) };
  return { ...base, type: kind === "choice" ? "choice" : "gap", items: out };
}

/* ---------- Lessons ---------- */

const plan = readFileSync(join(root, "grammar.md"), "utf8");
const levels = [];
const done = [];
for (const line of plan.split("\n")) {
  const lv = line.match(/^## ([ABC]\d) — (.+)$/);
  if (lv) { levels.push({ id: lv[1], title: lv[2], lessons: [] }); continue; }
  const ls = line.match(/^### (\d+)\. (.+?)(?: — \[урок\].*)?$/);
  if (ls && levels.length) {
    levels[levels.length - 1].lessons.push(+ls[1]);
    if (ls[2].includes("✅")) done.push(+ls[1]);
  }
}

const lessons = {};
const stats = {};
for (const f of readdirSync(join(root, "grammar")).filter((f) => /^\d{2}-.+\.md$/.test(f)).sort()) {
  const src = readFileSync(join(root, "grammar", f), "utf8");
  const n = +f.slice(0, 2);
  const title = src.match(/^# \d+\. (.+)$/m)[1].trim();
  const [beforeEx, afterEx = ""] = src.split(/^## Упражнения\s*$/m);
  const [exPart, ansPart = ""] = afterEx.split(/^## Ответы\s*$/m);
  const body = beforeEx.replace(/^# .+$/m, "");
  const mainMatch = body.match(/^## Главное за 30 секунд\s*\n([\s\S]*?)(?=^## )/m);
  const intro = body.slice(0, body.search(/^## /m)).trim();
  const rest = mainMatch ? body.replace(mainMatch[0], "") : body;
  const answers = Object.fromEntries(chunks(ansPart).map((c) => [exNumber(c.head), c.body]));
  const exercises = chunks(exPart).map((c) => parseExercise(c.head, c.body, answers[exNumber(c.head)]));
  for (const e of exercises) stats[e.type] = (stats[e.type] || 0) + 1;
  // Levels in grammar.md cover lessons 1-26; anything else goes to the last level.
  if (!levels.some((l) => l.lessons.includes(n)) && levels.length) levels[levels.length - 1].lessons.push(n);
  const level = levels.find((l) => l.lessons.includes(n));
  lessons[n] = {
    title,
    level: level ? level.id : "",
    intro: md(intro),
    main: mainMatch ? md(mainMatch[1]) : "",
    body: md(rest.slice(rest.search(/^## /m) >= 0 ? rest.search(/^## /m) : rest.length), 0),
    exercises,
  };
}

const cheat = readFileSync(join(root, "cheatsheet.md"), "utf8");
const cheatTitle = cheat.match(/^# (.+)$/m)[1].trim();

const data = {
  levels: levels.map((l) => [l.id, l.title, l.lessons]),
  done,
  lessons,
  cheat: { title: cheatTitle, html: md(cheat.replace(/^# .+$/m, "")) },
};
writeFileSync(out, "window.GRAMMAR=" + JSON.stringify(data) + ";\n");
console.log(`${Object.keys(lessons).length} lessons, exercises by type ${JSON.stringify(stats)}, done ${done.join(",")} → ${out}`);
