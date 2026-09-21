# Mistakes & Errors Log

A running, honest record of real defects and process failures introduced by
the AI agent working on this repo/account — kept because resources (time and
money) were spent on this work and failures should be tracked, not glossed
over. New entries are appended at the top. Each entry states what went
wrong, the root cause, who's accountable, and how/whether it was fixed.

---

## 2026-09-19 — Pasted a tool-display artifact into real backend code

**What happened:** While writing the new `/api/start-live-avatar` route in
`services/urartuhi-docent/index.js`, I copied the existing `Authorization`
header line as a template and accidentally included the literal masked
text (`` `****** ``) that my own file-viewer shows for secret-looking
header lines, instead of the real `apiKey` variable. This would have been
a syntax error / broken request had it shipped.

**Root cause:** Careless copy-paste from a rendered view of the file
without re-reading the line I pasted, so a cosmetic display artifact (not
real file content) ended up in new code.

**Caught by:** Running `node --check` immediately after the edit, before
any commit or deploy, as required by the "check before running" standard
I committed to. Fixed in the same turn; confirmed `node --check` passes
after the fix.

**Accountable:** Me. No user time or money was spent on this one — caught
before it left my own editing step — but it's logged because it's exactly
the kind of unverified change this log exists to prevent.

---

## 2026-09-19 — Built the wrong category of "interactive avatar"

**What happened:** Asked to build an interactive, animated, voice-driven
avatar "like a real person," I instead built a static generated image
(OpenAI Images) plus a CSS bar that toggles on/off while audio plays — not
real facial animation or lip-sync, and still driven by a style-preset
picker instead of a free-text character prompt.

**Root cause:** Misjudged the scope of "interactive avatar" as an extension
of the existing image generator instead of recognizing it as a different
product category (real-time animated talking-head video), which requires a
different kind of third-party API entirely (e.g. Tavus, LemonSlice,
HeyGen — none configured in this repo).

**Accountable:** Agent. Should have surfaced the real-time-video-avatar
category and asked which provider to integrate earlier, instead of
building further on the static-image approach.

**Status:** Corrected direction after user feedback; researched real
providers (Tavus, LemonSlice, HeyGen, D-ID, Synthesia) and their actual
API contracts before proposing next steps. Awaiting provider choice before
building (requires a new paid API key the agent cannot obtain itself).

## 2026-09-19 — UTF-8 BOM in `services/urartuhi-docent/package.json` / `index.js`

**Impact:** Broke the entire Railway backend (every route 404'd, including
a pre-existing unrelated route) after PR #2 merged.

**Root cause:** Committed files retained a leading UTF-8 byte-order-mark,
which broke Railway's Railpack JSON parser for `package.json` at build
time.

**Accountable:** Agent — should have been caught with a basic
encoding/syntax check before pushing.

**Status:** Fixed in PR #3. Verified live (previously-404 route returned
200 after redeploy).

## 2026-09-19 — 413 "Payload Too Large" on avatar generation with reference image

**Impact:** Avatar generation failed whenever a user attached a reference
image.

**Root cause:** Express's default 100kb JSON body limit was never raised
for the larger base64 image payload this feature introduced.

**Accountable:** Agent — omission in the initial PR #2 implementation.

**Status:** Fixed in PR #4 (limit raised to 10mb). Verified live.

## 2026-09-19 — Redundant post-completion verification

**Impact:** After already confirming all backend routes worked via direct
HTTP calls, ran a second, slower live UI click-through test (~40s real
image generation) as extra confirmation — unnecessary given evidence
already in hand, added avoidable time/cost.

**Root cause:** Did not recognize "sufficient proof" had already been
reached before continuing to test further.

**Accountable:** Agent.

**Status:** Noted; no further action needed (informational).

---

*Not logged here: the OpenAI API key becoming invalid on Railway — that was
an external credential/account issue outside the agent's access, fixed by
the user directly via Railway's own tooling.*
