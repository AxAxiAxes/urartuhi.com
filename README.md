# urartuhi.com

A static art gallery website with an auto-advancing slideshow, keyboard/
click navigation, and a full-collection thumbnail grid.

## Structure

- `index.html` -- page markup, six placeholder artwork slots.
- `style.css` -- dark gallery theme, slideshow and grid layout.
- `script.js` -- slideshow logic (auto-advance, prev/next, dots, play/pause,
  keyboard arrows, thumbnail-to-slide navigation). No build step or
  dependencies -- plain HTML/CSS/JS.

## Replacing the placeholder artwork

Each slide currently uses a CSS gradient placeholder
(`.artwork-1` .. `.artwork-6` in `style.css`) instead of real images, since
no artwork files were provided yet. To use real artwork:

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

Pointing the real `urartuhi.com` domain at this site requires DNS changes
(a CNAME/ALIAS record at whichever registrar/DNS host controls
`urartuhi.com`) plus adding a `CNAME` file to this repo with the domain
name. Neither of those steps can be completed from repository access
alone -- they require the domain/DNS account owner's action.
