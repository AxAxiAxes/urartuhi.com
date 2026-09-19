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
