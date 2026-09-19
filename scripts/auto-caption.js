#!/usr/bin/env node
/**
 * Auto-captions any new gallery images that are missing real titles/descriptions
 * in images/manifest.json, using OpenAI's vision-capable chat completions API.
 *
 * Runs in CI (see .github/workflows/auto-caption.yml) whenever files are pushed
 * under images/gallery/**. Requires an OPENAI_API_KEY secret on this repo -- if
 * it is not set, the script exits cleanly without making changes (no crash, no
 * fake captions), so a missing secret never breaks the workflow run.
 *
 * Only touches entries whose "meta" field still has the placeholder text
 * ("Uncaptioned upload - edit images/manifest.json to add a title") or whose
 * file is missing from the manifest entirely. Existing hand-written captions
 * are never overwritten.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const GALLERY_DIR = path.join(REPO_ROOT, "images", "gallery");
const MANIFEST_PATH = path.join(REPO_ROOT, "images", "manifest.json");
const PLACEHOLDER_META =
  "Uncaptioned upload - edit images/manifest.json to add a title";

const EXT_TO_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return [];
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

function listGalleryFiles() {
  return fs
    .readdirSync(GALLERY_DIR)
    .filter((name) => EXT_TO_MIME[path.extname(name).toLowerCase()])
    .sort();
}

function needsCaption(entry) {
  if (!entry) return true;
  return !entry.meta || entry.meta === PLACEHOLDER_META;
}

async function captionImage(apiKey, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mime = EXT_TO_MIME[ext];
  const filePath = path.join(GALLERY_DIR, fileName);
  const base64 = fs.readFileSync(filePath).toString("base64");

  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an art gallery curator writing short, evocative captions " +
          "for a dark-themed digital art gallery called 'An Instant In " +
          "Eternity | Urartuhi'. Respond with ONLY a JSON object with keys " +
          '"title" (2-5 words, evocative), "meta" (one short descriptive ' +
          "line, e.g. medium/style), \"alt\" (one plain factual sentence " +
          'describing the image for accessibility), and "tags" (2-4 ' +
          "lowercase single-word tags). No extra commentary, no markdown.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Caption this gallery image (file: ${fileName}).`,
          },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${base64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed for ${fileName}: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No caption content returned for ${fileName}`);
  return JSON.parse(content);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(
      "OPENAI_API_KEY not set -- skipping auto-caption run (no changes made)."
    );
    return;
  }

  const manifest = loadManifest();
  const byFile = new Map(manifest.map((entry) => [entry.file, entry]));
  const files = listGalleryFiles();

  let updated = 0;
  for (const fileName of files) {
    const relPath = `gallery/${fileName}`;
    const existing = byFile.get(relPath);
    if (!needsCaption(existing)) continue;

    console.log(`Captioning ${relPath} ...`);
    let caption;
    try {
      caption = await captionImage(apiKey, fileName);
    } catch (err) {
      console.error(`  Skipped (${err.message})`);
      continue;
    }

    const newEntry = {
      file: relPath,
      title: caption.title || existing?.title || "Gallery Piece",
      meta: caption.meta || PLACEHOLDER_META,
      alt: caption.alt || "Untitled gallery artwork",
      tags: Array.isArray(caption.tags) ? caption.tags : [],
    };

    if (existing) {
      Object.assign(existing, newEntry);
    } else {
      manifest.push(newEntry);
    }
    updated += 1;
  }

  if (updated > 0) {
    saveManifest(manifest);
    console.log(`Updated ${updated} manifest entr${updated === 1 ? "y" : "ies"}.`);
  } else {
    console.log("Nothing to caption -- manifest already up to date.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
