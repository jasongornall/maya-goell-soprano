# Maya Goell Soprano — static remake

A plain HTML/CSS remake of [mayagoellsoprano.com](https://www.mayagoellsoprano.com/)
(the Squarespace original), rebuilt as a static site for GitHub Pages.
No frameworks, no build step: what you see in the files is what ships.

## Layout

- `index.html` — Bio: headshot, About the Artist, Press quotes
- `gallery.html` — photo grid
- `engagements.html` — heading plus the same PosterMyWall calendar embed the live site uses
- `lessons.html` — Music Lessons info and FAQ
- `blog.html` — the blog/newsletter posts, rendered as static articles
- `contact.html` — contact page (see the placeholder note inside the file:
  the Squarespace form cannot run on a static site)
- `style.css` — the one shared stylesheet for every page
- `assets/img/` — all photos, downloaded from the live site and resized

## How to edit

Edit the `.html` file for the page you want to change and push.
Text sits in plain `<p>` and `<h2>`/`<h3>` tags, in reading order.

Two conventions to keep:

1. **Cache-buster:** every page links the stylesheet as
   `style.css?t=<timestamp>`. When you publish changes, bump that
   number (e.g. to the current Unix time) in *every* HTML file so
   browsers pick up the new CSS instead of a cached copy.
2. **Header/footer are copy-pasted** into each page (there is no
   template engine in a plain static site). If the nav changes,
   change it in all six HTML files.

## Known differences from the Squarespace site

- The contact form cannot be replicated statically; the contact page
  points to her Instagram/Facebook until a real email or a form
  service (e.g. Formspree) is added. See the comment in `contact.html`.
- Squarespace commerce (`/cart`) is not part of this remake.
- The live footer LinkedIn icon pointed at Squarespace's own company
  page (a leftover default), so it was left off here.
