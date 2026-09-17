# urartuhi.com -- An Instant In Eternity

A static art gallery website. The main page ("An Instant In Eternity")
features a single centerpiece artwork -- *The Well Of Pure Source,
Axpure* -- with an author credit, followed by an additional-pieces
slideshow with an auto-advancing slideshow, keyboard/click navigation,
and a thumbnail grid.

## Structure

- `index.html` -- page markup: featured artwork section, then six
  placeholder artwork slots in the slideshow/grid.
- `style.css` -- dark gallery theme, featured-work, slideshow, and grid
  layout.
- `script.js` -- slideshow logic (auto-advance, prev/next, dots, play/pause,
  keyboard arrows, thumbnail-to-slide navigation). No build step or
  dependencies -- plain HTML/CSS/JS.
- `images/well-of-pure-source-axpure.jpg` -- the featured centerpiece
  artwork.

## Replacing the placeholder artwork

The six slideshow slots below the featured piece currently use CSS
gradient placeholders (`.artwork-1` .. `.artwork-6` in `style.css`)
instead of real images, since no additional artwork files were provided
yet. To use real artwork:

1. Add image files under an `images/` folder (create it at the repo root).
2. In `style.css`, replace each `.artwork-N` gradient with
   `background-image: url("images/your-file.jpg");`.
3. In `index.html`, update the `aria-label` and the `.title` / `.meta`
   figcaption text for each slide to match the real piece.
4. Add or remove `<figure class="slide">` blocks in `index.html` to match
   how many artworks you have -- the slideshow, dots, and grid all
   generate themselves from however many `.slide` elements exist.

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
