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
- `images/manifest.json` -- the list of 34 original additional
  slideshow/grid artworks. An empty array (`[]`) shows a friendly
  "no pieces yet" note; a failed manifest request shows a load error,
  not a misleading empty gallery.

## Adding artwork (including bulk uploads)

### Bulk selection for a private local slideshow

Open **Slideshow viewer** from the original gallery navigation
(`slideshow.html`, locally `http://127.0.0.1:8768/slideshow.html`).
This dedicated browser app uses the same manifest, image picker, controls,
and gallery script as the original page; no separate service or framework.
The larger neutral stage fits whole portraits and landscapes without
distortion/cropping by default. **Fill frame (crop)** is an explicit opt-in;
**Fit whole image** reverses it. **Fullscreen** expands the image stage and
controls where the browser allows it; Escape exits. Gallery and companion
links tie the viewer back to the existing site. No backend is required.

On either page, use **Add images to this slideshow -> Choose multiple
images (local only)**. Select multiple files from your device or a synced
OneDrive folder using the system file picker. Accepted images are appended
to the original slideshow and thumbnails, with a `local` tag; navigation,
autoplay, pause, and filtering still work. Choose again to add more.
**Clear local images** removes all selected images and restores the original
gallery. Reloading also discards the local selection.

This is not a OneDrive integration or a server upload: selected image bytes
stay in browser memory through object URLs, never sent to AI, cloud storage,
or the repository. Nothing is published or saved to localStorage. Only
explicitly selected files are read. Limits: 50 local images, 10 MiB per
file, 100 MiB total, and 20 megapixels per image; JPEG/PNG/WebP/GIF only.
Unreadable, unsupported, oversized, and over-limit files are rejected with
visible feedback. Object URLs are released on rejection, clearing, or
leaving the page (except when retained in the browser's back/forward cache).
Cloud-only OneDrive files must first be made available through the system
file picker; this page does not connect to your OneDrive account.

### Publishing permanent gallery artwork

There is no fixed limit on how many images this page can hold -- it is a
plain static site with no publishing backend. Permanent "uploading" means
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

Uses your **existing Tavus account, PAL and face** for a real-time video
conversation. This is distinct from the static image generator and from
the separate historical Eternal AI project. The description supplies
conversation context; it does not generate a new face or change your
account's voice/PAL configuration.

**Owner setup (no new account or purchase required by this code):**

1. In your existing Tavus dashboard, locate the API key and existing PAL
   with a valid default face, or the existing face ID. Do not paste API
   keys into chat, the HTML, the browser access-code field, or the repo.
2. Open the Railway service that serves
   `https://urartuhicom-production.up.railway.app` (historically named
   `urartuhi.com`). In **Variables**, privately set `TAVUS_API_KEY` and
   `TAVUS_PAL_ID`, or `TAVUS_FACE_ID` if using a face without a PAL.
   If both IDs are supplied, the face overrides the PAL's default face.
   These names match the current official contract checked 2026-10-17:
   [Create conversation](https://docs.tavus.io/api-reference/conversations/create-conversation).
   Do not relabel legacy persona/replica IDs without confirming them in
   your current account; this implementation sends `pal_id`/`face_id`.
3. Also set `TAVUS_ACCESS_CODE` to a new private random owner code of at
   least 16 characters. This is **not** your Tavus API key. It prevents
   anonymous public visitors from creating chargeable calls. Share it
   only with intended users, not in chat/repo/logs. Configure through the
   Railway dashboard; no Railway account access is available in this task.
4. Deploy this branch's backend changes (`services/urartuhi-docent`,
   `npm start`) and publish the updated static page. The current live
   backend's new readiness endpoint returned HTTP 404 before deployment;
   the local static preview cannot deploy it or configure its variables.
5. Open `live-avatar.html` (local preview:
   `http://127.0.0.1:8768/live-avatar.html`) and **Check setup again**.
   `GET /api/live-avatar-status` checks server variable presence only:
   it never contacts Tavus, exposes key/ID values, validates a license,
   verifies credits, or starts a call. Ready means configured, not
   authenticated end-to-end.
6. When you choose to use your plan credits, enter the private owner code,
   context, and media/cost consent, then Start. Only this explicit action
   creates a Tavus session. The embedded provider UI asks for media
   permissions. Selected slideshow images are not connected or sent.

**Lifecycle and cost controls:** `services/urartuhi-docent/tavus.js`
registers readiness, start, and end routes. API keys stay server-side;
provider errors are sanitized. Start requires an approved origin and
private owner code; calls use private meeting tokens, two participants
maximum, a five-minute provider duration cap, 60-second absent and
30-second participant-left timeouts, with recording disabled. Only one
call/start is allowed per server process; an uncertain creation holds a
six-minute retry lock to avoid accidental duplicates. This is a
single-instance owner setup, not multi-user billing or distributed rate
limiting. A server restart loses its cleanup capability/lock; provider
timeouts still apply. Do not scale replicas without shared session state.
Your existing Tavus subscription/license controls actual charges/credits;
these safeguards are not a guarantee that usage is free.

**End conversation** removes the iframe and calls
`POST /api/end-live-avatar`, which uses the returned session-scoped cleanup
token to call Tavus's non-destructive
[End Conversation](https://docs.tavus.io/api-reference/conversations/end-conversation)
endpoint. It does not delete conversation records. Failed End is visible
and retryable, with Start blocked; use your Tavus dashboard if necessary.
Navigation cleanup is best-effort, with provider timeouts as backstop.
Room creation is not presented as a connected video call.

**Verification:** `cd services/urartuhi-docent`, then `npm test` (Node 22+).
Tests mock Tavus; no real provider calls, account changes, purchases, or
paid sessions are made by tests/setup checks. Live account/license/key
validity and real camera/microphone conversation still require the owner
to configure Railway and explicitly start an authorized session.

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

Serve the repository root over HTTP so the browser can fetch the gallery
manifest (opening `index.html` as a file can block that request):

```
npx serve .
```

Alternatively, with Python installed, run `python -m http.server 8768 --bind
127.0.0.1` and open `http://127.0.0.1:8768/`. The original pages are
`/avatar.html`, `/companion.html`, and `/live-avatar.html`; extensionless
paths depend on the host and are not required for this static preview.
Previewing the gallery needs no AI key or paid API requests. Generating
images, chatting, or requesting backend speech can incur provider charges.

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

### Recovery findings (2026-10-17 PDT)

The original site has not been deleted from this repository. The gallery
and 34 images were added in `6417742`; the avatar and companion pages in
`41ab1cf` (PR #2). The current Pages build is `e87f089` (PR #11), published
from `main`, root directory, with custom domain `urartuhi.com`.

Read-only checks found:

- The apex returned no A record; `www` pointed to
  `qclosrzd.up.railway.app`, whose root returned Railway's 404 fallback.
- GitHub Pages reported `built`, but `https_enforced: false`. Its default
  `github.io` URL redirects to the broken custom domain, so it is not an
  independent recovery URL.
- Bypassing DNS with
  `curl.exe --resolve urartuhi.com:80:185.199.108.153 http://urartuhi.com/`
  returned the original gallery (HTTP 200). This is a diagnostic only,
  not a DNS change or a secure public URL. HTTPS with the same pinned
  address failed certificate-name validation; do not disable TLS checks
  as a workaround.
- The original backend is
  `https://urartuhicom-production.up.railway.app`, **not** the `qclosrzd`
  hostname. Its root returned `{"name":"Urartuhi Docent","status":"live"}`.
  No paid OpenAI requests were made, so this does not establish that its
  configured key or paid generation/chat/speech routes work.
- The live-avatar route reported missing `TAVUS_API_KEY`. This was an
  already-documented unfinished integration, not a slideshow regression.
  No new provider account, credentials, or subscription is needed to
  restore the original static slideshow.

**Owner action to restore public access:** in SiteGround's DNS Zone
Editor, add the four apex A records listed above and replace only the
incorrect `www` CNAME with `axaxiaxes.github.io`. Preserve unrelated
MX/TXT/mail records and other subdomains. These values match
[GitHub's official custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
In [Settings -> Pages](https://github.com/AxAxiAxes/urartuhi.com/settings/pages),
keep `main` / root and custom domain `urartuhi.com`; allow DNS propagation
and certificate issuance, then enable Enforce HTTPS. Confirm both
`https://urartuhi.com/` and `https://www.urartuhi.com/` work without TLS
warnings and that `/avatar.html` loads. No hosting or DNS settings were
changed during recovery; repository changes alone cannot repair DNS.

`automate.ps1` updates only the docent URL in local files. It must retain
the browser widget in `js/urartuhi-docent.js`, never copy the Express
backend there, and does not stage, commit, or push changes. The avatar,
companion, and live-avatar backend URLs remain in their own HTML pages;
review those separately if the backend hostname ever changes.

### Original gallery whisper and avatar companion

The historical on-gallery **Urartuhi whisper** (introduced in `9eb5e33`)
was broken: deployment commit `908f5cb` copied Express server code into its
browser script, and its earlier play-button selector did not match the
slideshow controls. The browser widget is restored with an explicit
**Ask Urartuhi about this artwork** launcher beneath the slideshow, its
original fixed-bottom whisper/question panel, and Close/Escape controls.
Opening it makes no provider call; Narrate or Ask explicitly sends only
the selected original public artwork URL/title/question to the existing
AI backend. Local selected images are blocked from this route. Replies
are rendered as text, not HTML. Live paid responses have not been verified.

The original avatar-based companion is a separate `companion.html` page:
saved-avatar picker, gold-frame portrait, persona, chat, and voice controls.
The gallery now explicitly links **Open avatar companion chat** next to
the whisper launcher. No background animated-avatar layer was found in
the inspected source/history. The separate `live-avatar.html` remains the
historically incomplete Tavus integration, not a replacement slideshow.
