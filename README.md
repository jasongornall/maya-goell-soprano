# Maya Goell Soprano — static remake

A plain HTML/CSS remake of [mayagoellsoprano.com](https://www.mayagoellsoprano.com/)
(the Squarespace original), rebuilt as a static site for GitHub Pages.
No frameworks, no build step: what you see in the files is what ships.

## Layout

- `index.html` — Bio: headshot, About the Artist, Press quotes
- `gallery.html` — photo grid
- `engagements.html` — month calendar grid (drawn from `events.json`) beside the same PosterMyWall calendar embed the live site uses
- `events.json` — the events shown in that month grid; see "Updating the calendar" below
- `lessons.html` — Music Lessons info and FAQ
- `blog.html` — the blog/newsletter posts, rendered as static articles
- `contact.html` — contact page with a working form; the form posts
  to the Cloudflare Worker in `worker/` (see `worker/README.md`)
- `worker/` — the small Cloudflare Worker that receives the contact
  form, saves submissions in a D1 database, and emails them to Maya
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
   change it in all eight HTML files.

## Updating the calendar

The Engagements page's month grid is drawn from `events.json`,
a plain data file at the top of this repo. It is a JSON array
with one object per event:

```json
[
  {
    "date": "2026-12-05",
    "title": "Holiday Concert",
    "time": "19:30",
    "location": "Some Hall, San Diego",
    "url": "https://example.com/tickets"
  }
]
```

- `date` (required): `YYYY-MM-DD`
- `title` (required): what the event is called
- `time` (optional): 24-hour `HH:MM`; leave it out for all-day events
- `location` (optional), `url` (optional): a link to the event page

Muse maintains this file: Jason just says the gig details in
chat and the event appears on the calendar. An empty array
(`[]`) is fine; the grid simply shows an empty month.

Clicking an event (a marked day in the grid, or an entry in the
list under it) opens a popup with the event's details and an
"Add to calendar" row: a Google Calendar link, and an
Apple / Outlook option that downloads an `.ics` file for that
event. Both are generated in the browser by the script at the
bottom of `engagements.html`; there is no server involved.
The PosterMyWall widget next to the grid is separate and keeps
updating itself as before.

## Known differences from the Squarespace site

- The contact form runs on a small Cloudflare Worker (the `worker/`
  folder) instead of Squarespace: it saves every submission in a
  database and emails it to Maya, protected by Cloudflare
  Turnstile like the original form. Email delivery switches on
  once Maya's destination address is confirmed; until then
  submissions are saved and waiting. See `worker/README.md`.
- Squarespace commerce (`/cart`) is not part of this remake.
- The footer includes the same LinkedIn link as the original's
  footer, in the same order (Instagram, LinkedIn, Facebook). Note
  that the original's link points at Squarespace's own company
  page, a leftover default on the Squarespace side; it is kept
  here so the footer matches, and it is a one-line change in each
  page's footer if Maya has a real profile URL to use instead.
- The original's Engagements month grid was a Squarespace block;
  here the grid is drawn from `events.json` instead (see
  "Updating the calendar" above), beside the same PosterMyWall
  widget the original uses.
