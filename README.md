# urartuhi.com -- An Instant In Eternity

A static art gallery website. The main page ("An Instant In Eternity")
features a single centerpiece artwork -- *The Well Of Pure Source,
Axpure* -- with an author credit, followed by an additional-pieces area:
an auto-advancing slideshow with keyboard/click navigation, and a
Pinterest-style masonry thumbnail grid with optional tag filtering.

## Structure

- `index.html` -- page markup: featured artwork section, plus an
  additional-pieces slideshow/tag-filter/grid that is populated
  dynamically by JavaScript at page load.
- `style.css` -- dark gallery theme, featured-work, slideshow, masonry
  grid, and tag-filter layout.
- `script.js` -- fetches `images/manifest.json` and builds the slideshow
  (auto-advance, prev/next, dots or a "N / total" counter once past
  `DOT_UI_LIMIT` pieces, play/pause, keyboard arrows), the tag-filter bar,
  and the masonry thumbnail grid from it. No build step or dependencies
  -- plain HTML/CSS/JS.
- `images/well-of-pure-source-axpure.jpg` -- the featured centerpiece
  artwork (shown separately, above the slideshow).
- `images/gallery/` -- additional artwork image files.
- `images/manifest.json` -- the list of additional slideshow/grid
  artworks. Starts empty (`[]`); the page shows a friendly "no pieces
  yet" note until you add entries.

## Adding artwork (including bulk uploads)

There is no fixed limit on how many images this page can hold -- it is a
plain static site with no upload form or backend. "Uploading" means
committing image files to this repository's `images/` folder and listing
each one in `images/manifest.json`. Practical ceiling: GitHub blocks any
single file over 100MB, and a repository should stay well under ~1GB as
good practice; for ordinary compressed photos/art (a few hundred KB to a
few MB each), that comfortably fits hundreds to low thousands of images.

To add one or many images at once:

1. Add the image file(s) under `images/` (any typical web image format:
   `.jpg`, `.png`, `.webp`, `.gif`, etc).
2. Add one object per image to the `images/manifest.json` array:

   ```json
   [
     {
       "file": "gallery/your-file-name.jpg",
       "title": "Piece title",
       "meta": "Medium · Year",
       "alt": "A short description of the image for accessibility",
       "tags": ["portrait", "gold"]
     }
   ]
   ```

   `tags` is optional -- omit it (or leave it `[]`) for an untagged
   piece. Any entry with tags automatically appears under the matching
   filter button(s) in the "Additional pieces" section; the filter bar
   itself only appears once at least one entry has tags.

3. Commit and push (or hand the files + titles to whoever manages this
   repo to commit in one batch) -- the page picks up any number of
   manifest entries automatically, in the order listed, with no other
   code changes required.

The featured centerpiece image above the slideshow is separate (a single
`<img>` in `index.html`) and is not part of the manifest; swap its `src`
directly in `index.html` to change it.

### Auto-captioning new uploads

You no longer have to hand-write `title`/`meta`/`alt`/`tags` for every new
image. `.github/workflows/auto-caption.yml` runs
`scripts/auto-caption.js` automatically on every push that adds files
under `images/gallery/`:

1. It scans `images/gallery/` for any file that is missing from
   `images/manifest.json`, or whose entry still has the placeholder
   `"Uncaptioned upload - edit images/manifest.json to add a title"`
   text.
2. For each one, it sends the image to OpenAI's vision-capable chat
   completions API and asks for a short title, one-line description,
   accessible alt text, and 2-4 tags.
3. It writes the results back into `images/manifest.json` and commits
   the change automatically.

**Setup required (one-time):** add an `OPENAI_API_KEY` repository secret
(Settings -> Secrets and variables -> Actions -> New repository secret).
Without it, the workflow runs but makes no changes -- it never fabricates
captions or fails the build. Existing hand-written captions are never
overwritten; only placeholder/missing entries are touched.

You can also run it manually via the Actions tab ("Auto-caption gallery
uploads" -> Run workflow), or locally with `OPENAI_API_KEY=... node
scripts/auto-caption.js`.

## Companion Chat (`/companion`, `companion.html`)

A small, **family-friendly-only** text companion page: pick a saved avatar
(from the generator above) or go faceless, name your companion and give it
a short personality description, then chat with it.

- `companion.html` / `companion.css` / `companion.js` -- page markup,
  styling, and client logic; reuses the `.gold-frame` treatment from the
  avatar page and the same `localStorage` list of saved avatars.
- **Backend:** `POST /api/companion-chat` in
  `services/urartuhi-docent/index.js`, reusing the same `OPENAI_API_KEY`
  secret as `/api/narrate` and `/api/generate-avatar`. The system prompt
  explicitly instructs the model to keep every reply PG/family-safe and to
  decline and redirect any romantic, explicit, or adult roleplay request,
  even if asked to ignore that instruction. This is intentionally **not**
  an adult/romantic companion and is not designed to be reconfigured into
  one.
- Conversation history is kept in memory only (cleared on page reload /
  "End chat"); nothing is persisted to the gallery or manifest.
- **Voice**: prefers higher-quality speech via `POST /api/tts` (OpenAI
  TTS, `tts-1`) with a voice picker (`nova` female voice by default, plus
  shimmer/alloy/echo/fable/onyx) -- falls back automatically to the
  browser's built-in `SpeechSynthesis` (attempting to auto-pick a
  female-sounding system voice) if the backend TTS call fails or the
  backend isn't deployed. A mic button (shown only if the browser supports
  `SpeechRecognition` -- Chrome/Edge) transcribes speech into the message
  box. While the companion is speaking, the avatar's gold frame pulses and
  a small "mouth-flap" bar animates -- a lightweight stand-in for real
  lip-sync, which isn't feasible for a static image, not true viseme-based
  animation.
- **Continuing straight from the avatar generator**: the "Chat with this
  avatar" button on `/avatar` auto-saves the current avatar and opens
  `/companion?avatar=<id>`, which preselects that avatar and jumps
  straight into a chat -- so generating and interacting feel like one
  flow instead of two disconnected tools.

## Live Avatar (`/live-avatar`, `live-avatar.html`)

The actual "real animated, talking avatar" feature: a single free-text
"Describe your character" box (no style presets, no image generation
step) that starts a **real-time, spoken, face-to-face video conversation**
with a live animated character -- a fundamentally different technology
from `/avatar`'s static image generator.

- `live-avatar.html` / `live-avatar.css` / `live-avatar.js` -- page
  markup, styling (reuses the `.gold-frame` treatment from `avatar.css`),
  and client logic. On submit, it POSTs the character description to a
  pluggable `startLiveAvatar()` function and embeds the returned
  conversation URL in an `<iframe>` (camera/microphone permission
  requested by the provider's own embedded page).
- **Backend:** `POST /api/start-live-avatar` in
  `services/urartuhi-docent/index.js`, wrapping **Tavus's Conversational
  Video Interface** (`POST https://tavusapi.com/v2/conversations`).
  Requires two Railway env vars that are **not yet configured** anywhere
  in this repo:
  - `TAVUS_API_KEY` -- from https://platform.tavus.io.
  - `TAVUS_PAL_ID` (preferred) or `TAVUS_FACE_ID` -- a face/persona bundle
    you create once in the Tavus dashboard. Tavus needs an existing face
    to animate; it cannot generate one from a text prompt alone, so this
    step can't be automated by the agent and must be done by you.
  Until both are set, the route returns a clear "not configured" error
  instead of a broken iframe or a fabricated response.
- No credentials for this provider exist in this environment yet, so this
  feature has **not** been tested end-to-end against a live Tavus call --
  only the UI, the error path (missing-key case), and JS/element wiring
  have been verified. Once `TAVUS_API_KEY` + `TAVUS_PAL_ID`/`TAVUS_FACE_ID`
  are set on the `urartuhi.com` Railway service, a live smoke test is
  still needed.

## Avatar Generator (`/avatar`, `avatar.html`)

A small, self-contained page for generating a personal Urartuhi-styled
avatar: optional reference image upload, prompt, a style preset selector
(Axpure Water-Light, Gold Ornamental Frame, Cosmic Gradient, Eternal
Instant), a preview inside a gold-frame treatment, and Save/Download
buttons. "Recently generated" avatars are shown below in the same masonry
grid component used by the main gallery.

- `avatar.html` / `avatar.css` / `avatar.js` -- page markup, styling, and
  client logic. No build step, same plain HTML/CSS/JS approach as the rest
  of the site.
- **Generation backend:** `avatar.js`'s `generateAvatar()` function is
  pluggable -- it POSTs to `window.URARTUHI_AVATAR_BACKEND` (set in
  `avatar.html`, pointed at the existing Railway service). The corresponding
  route, `POST /api/generate-avatar` in `services/urartuhi-docent/index.js`,
  wraps **OpenAI's Images API (`gpt-image-1`)** and reuses the same
  `OPENAI_API_KEY` secret already required for `/api/narrate`. No key is
  hardcoded in this repo. If the key is missing (or the route hasn't been
  deployed yet), the page shows a friendly inline error instead of crashing.
  Swap the provider by editing `generateAvatar()` and/or the backend route.
- A **"Photorealistic" checkbox** appends realism wording (natural skin
  texture, camera-like lighting/depth of field) to the prompt regardless of
  which style preset is selected, for a more realistic-looking result.
- **"Save to Gallery" is browser-local only.** This is a static site with
  no server-side write access from the browser, so saved avatars are kept
  in `localStorage` (per browser) and rendered in the "Recently generated"
  grid -- they are **not** automatically added to `images/manifest.json` or
  the public gallery. To promote a saved avatar to the permanent gallery on
  urartuhi.com, download it and follow the same manual steps as any other
  upload: add the file under a new `images/avatars/` folder and add one
  matching entry to `images/manifest.json` (see "Adding artwork" above for
  the exact schema).

## Scaling to a large collection

This site is designed to scale the same way image-heavy sites like
Pinterest do at small scale: images are stored as flat files and indexed
by a manifest, not hand-authored per-piece markup, so growth is a data
change, not a code change. Specifically:

- **Masonry grid** -- the thumbnail grid uses CSS `columns` and keeps
  each image's natural aspect ratio (no forced square crop), so it looks
  and scales the same with 10 images or 1,000.
- **Tag filtering** -- add a `tags` array to any manifest entry to make
  the collection browsable by category as it grows, instead of one long
  undifferentiated grid.
- **Slideshow dot limit** -- one dot per slide stops being usable well
  before a few dozen pieces, so past `DOT_UI_LIMIT` (12, in `script.js`)
  the slideshow shows a plain "N / total" counter instead; prev/next
  arrows, keyboard arrows, and grid thumbnails still navigate normally.
- **Lazy loading** -- both slideshow and grid images use
  `loading="lazy"`, so the browser only fetches images as they scroll
  into view.
- What this site intentionally does **not** add: cookie-based tracking,
  personalized/algorithmic ranking, or a real upload form/backend. It is
  a static GitHub Pages site with no server; genuine personalization
  would need a backend and would also raise cookie-consent/privacy
  obligations (e.g. GDPR/CCPA) that are a founder decision, not a
  default addition.

## Local preview

Open `index.html` directly in a browser, or serve the folder locally:

```
npx serve .
```

## Deployment

This repository is deployed via **GitHub Pages** from the `main` branch
(see repository Settings -> Pages), giving a live URL at
`https://axaxiaxes.github.io/urartuhi.com/`.

A `CNAME` file naming `urartuhi.com` has been added so GitHub Pages will
serve the custom domain once DNS is pointed at it. Pointing the domain
itself is a SiteGround DNS action outside this repository's control --
see below.

### Pointing urartuhi.com (hosted at SiteGround) to this GitHub Pages site

1. Log in to SiteGround -> Site Tools -> **Domain** -> **DNS Zone Editor**
   for `urartuhi.com`.
2. Add these DNS records (delete any existing A/CNAME records for the
   same names first, so they don't conflict):
   - Four `A` records for the root/apex `@` (or `urartuhi.com`), pointing
     to GitHub Pages' current IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
     `185.199.111.153`.
   - One `CNAME` record for `www`, pointing to `axaxiaxes.github.io`.
3. Wait for DNS propagation (can take anywhere from minutes to ~24
   hours).
4. In this repository's GitHub Settings -> Pages, confirm the custom
   domain `urartuhi.com` shows as verified/active once DNS resolves.
5. Enable "Enforce HTTPS" in that same Pages settings panel once the
   certificate has been issued (GitHub provisions it automatically after
   DNS is correctly pointed).

This DNS change must be made by whoever holds the SiteGround login for
this domain -- it cannot be done from GitHub or from this repository.
