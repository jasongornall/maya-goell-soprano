# The contact form Worker

The site itself is static files on GitHub Pages, and a static
page has no server to receive a form. This little Cloudflare
Worker is that missing receiver for the Contact page.

- **Worker name:** `maya-goell-contact`
- **Live URL:** https://maya-goell-contact.gornall-jason.workers.dev
- **Source:** `worker.js` in this folder (plain module Worker,
  no dependencies)
- **Database:** D1 database `maya-goell-contact`
  (uuid `91a8ebc6-dafd-44b1-83ac-12a9b6389062`), one table,
  `submissions`: id, created_at, name, email, phone, message,
  newsletter flag, emailed flag.

## What it does with a submission

1. **Spam checks first** (details below). Dropped spam gets a
   fake "success" answer, so bots learn nothing.
2. **The submission is saved in D1 before anything else.** The
   database row is the safety net: even if email is not set up
   yet, or sending fails, the message itself is never lost.
   Rows whose email did not go out have `emailed = 0`, so they
   are easy to find and forward by hand.
3. **Then it emails Maya** (once a destination is configured,
   see "Going live with email"), with Reply-To set to the
   visitor's address so she can just hit Reply.

Answers are JSON: `{ "ok": true }` on success, or a 400 with
`{ "ok": false, "error": "..." }` for a submission a human
should fix (a required field missing, a bad email address, a
failed Turnstile check). Only the site's own origin,
`https://jasongornall.github.io`, may call it from a browser;
when the site moves to the custom domain, add that origin in
`worker.js` (the `ALLOWED_ORIGIN` constant) and redeploy.

## Spam defenses (three layers)

1. **Cloudflare Turnstile (primary).** The original Squarespace
   form is protected by Turnstile, so this one is too. The
   widget is named `maya-goell-contact` in the Cloudflare
   account and covers `jasongornall.github.io`,
   `mayagoellsoprano.com`, and `www.mayagoellsoprano.com`.
   - The **site key** is public by design and sits in
     `contact.html`, where the widget renders above the Submit
     button.
   - The **secret** lives only in the Worker's secret store
     (set with `deploy.py set-turnstile-secret`, see below). It
     is never in this repo, in the source, or in any log.
   - The Worker verifies each submitted token server-side
     against Cloudflare's siteverify endpoint before saving
     anything. A token that fails is a hard 400.
   - If the widget itself cannot load on a visitor's browser
     (offline, an aggressive ad blocker), the form still
     submits with no token, and the two layers below decide.
     That is a deliberate choice: a real visitor with a broken
     widget should not be locked out of contacting Maya.
   - If no secret is configured on the Worker (e.g. it was
     deleted), verification quietly switches off and the form
     runs on honeypot + timing alone.
2. **Honeypot.** A "website" field the page hides off-screen
   (and marks `aria-hidden`, so screen readers skip it too).
   Humans leave it empty; form-filling bots fill it and get
   silently dropped.
3. **Minimum fill time.** The page stamps when the form was
   rendered; a submission arriving in under 3 seconds, or with
   no stamp, is a bot replaying the endpoint and is silently
   dropped.

## Going live with email (waiting on Maya's address)

Email sending is built in but **not switched on yet**, because
the destination address is a single config value that is
currently empty. Submissions are still received and saved in
D1 in the meantime. To switch it on:

1. Maya confirms the inbox the Squarespace form sends to.
2. That address must be a **verified destination** in this
   Cloudflare account's Email Routing (dashboard: Email
   Routing → Destination addresses → add it; Cloudflare sends
   her a verification email and she clicks the link). This is
   Cloudflare's anti-spam rule: a Worker may only send to
   addresses the account owner has proven they control.
3. Put the address in `worker.js` as `DESTINATION_EMAIL`
   (top of the file, marked CONFIG).
4. Redeploy: `python3 worker/deploy.py deploy`.
5. Send a test through the real form and check it arrives;
   the row in D1 should flip to `emailed = 1`.

One more thing to know: the notification's From address is
`contact-form@helpthemany.org`, because that domain is this
account's zone with Email Routing. If `mayagoellsoprano.com`
later moves into this Cloudflare account, change `FORM_FROM`
in `worker.js` to an address on that domain and redeploy.

## Redeploying and rotating the secret

```bash
# Upload worker.js and confirm the workers.dev address is on:
python3 worker/deploy.py deploy

# Store (or replace) the Turnstile secret. Put the secret alone
# in a plain text file, run this, then delete the file:
python3 worker/deploy.py set-turnstile-secret /path/to/secret.txt
```

Deploys replace the declared bindings (D1 + email), which is
why `deploy.py` resends both every time. Secrets in the secret
store are separate and survive deploys untouched.

## Reading saved submissions

Through the Cloudflare connector helper, e.g. the newest ten:

```bash
echo '{"sql":"SELECT id, created_at, name, email, emailed FROM submissions ORDER BY id DESC LIMIT 10"}' | \
  ~/workspace/custom-connectors/custom.cloudflare/bin/cf-api request POST \
  /accounts/2508c45a75fae136c0365c0d6b4d242c/d1/database/91a8ebc6-dafd-44b1-83ac-12a9b6389062/query
```
