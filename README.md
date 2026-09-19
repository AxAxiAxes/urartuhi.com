# urartuhi.com -- An Instant In Eternity

A static art gallery website. The main page ("An Instant In Eternity")
features a single centerpiece artwork -- *The Well Of Pure Source,
Axpure* -- with an author credit, followed by an additional-pieces
slideshow with an auto-advancing slideshow, keyboard/click navigation,
and a thumbnail grid.

## Structure

- `index.html` -- page markup: featured artwork section, plus an
  additional-pieces slideshow/grid that is populated dynamically by
  JavaScript at page load.
- `style.css` -- dark gallery theme, featured-work, slideshow, and grid
  layout.
- `script.js` -- fetches `images/manifest.json` and builds the slideshow
  (auto-advance, prev/next, dots, play/pause, keyboard arrows) and
  thumbnail grid from it. No build step or dependencies -- plain
  HTML/CSS/JS.
- `images/well-of-pure-source-axpure.jpg` -- the featured centerpiece
  artwork (shown separately, above the slideshow).
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
   `.jpg`, `.png`, `.webp`, etc).
2. Add one object per image to the `images/manifest.json` array:

   ```json
   [
     {
       "file": "your-file-name.jpg",
       "title": "Piece title",
       "meta": "Medium · Year",
       "alt": "A short description of the image for accessibility"
     }
   ]
   ```

3. Commit and push (or hand the files + titles to whoever manages this
   repo to commit in one batch) -- the page picks up any number of
   manifest entries automatically, in the order listed, with no other
   code changes required.

The featured centerpiece image above the slideshow is separate (a single
`<img>` in `index.html`) and is not part of the manifest; swap its `src`
directly in `index.html` to change it.

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
