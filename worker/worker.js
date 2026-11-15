// ============================================================
// maya-goell-contact — the tiny Worker behind the Contact page
// on Maya Goell's site (jasongornall.github.io/maya-goell-soprano).
//
// WHY a Worker at all: the site itself is static files on
// GitHub Pages, and a static page has no server to receive a
// form. This Worker is that missing receiver. It takes the
// form's POST, checks it is not spam, saves it in a D1 database
// (so nothing is ever lost), and emails it to Maya, duplicating
// what her Squarespace form did.
//
// Plain module Worker, no dependencies, no framework.
// ============================================================

import { EmailMessage } from "cloudflare:email";

// ============================================================
// CONFIG — the one place to change things.
// ============================================================

// Maya's inbox: where form submissions get emailed.
// EMPTY FOR NOW on purpose. While it is empty the Worker still
// saves every submission in the database, it just does not send
// email yet. When Maya confirms her address: (1) the address
// must be verified as a destination in this Cloudflare account's
// Email Routing (Cloudflare emails her a one-click verification),
// (2) put the address here, (3) redeploy (see worker/README.md).
const DESTINATION_EMAIL = "";

// The "From" address on the notification email. It must sit on
// a domain that has Email Routing enabled in this Cloudflare
// account; today the account's only zone is helpthemany.org, so
// the form borrows an address there. If mayagoellsoprano.com
// ever moves into this account, change this to an address on
// that domain instead.
const FORM_FROM = "contact-form@helpthemany.org";

// Only the live site may call this Worker from a browser.
// When the site moves to the custom domain, add
// "https://www.mayagoellsoprano.com" here too.
const ALLOWED_ORIGIN = "https://jasongornall.github.io";

// A human needs at least this long to fill the form in. Bots
// that blast the endpoint instantly (or replay without the
// timestamp the page sets) trip this check. See checkTiming().
const MIN_FILL_MS = 3000;

// The Turnstile SECRET is deliberately NOT in this file. It
// lives in the Worker's secret store (set with worker/deploy.py,
// never committed) and arrives as env.TURNSTILE_SECRET. When no
// secret is configured, verification is skipped and the honeypot
// and timing checks below carry the spam load on their own;
// worker/README.md explains how to switch it on.

// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------

// Every answer this Worker gives is JSON with the CORS header,
// so the page's fetch() is allowed to read it.
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    },
  });
}

// Strip characters that could break an email header. A name or
// address with a newline in it must never reach a header line,
// or a spammer could glue on extra headers of their own.
function cleanHeader(text) {
  return String(text || "").replace(/[\r\n]+/g, " ").trim();
}

// ------------------------------------------------------------
// Spam checks. Each returns true when the submission looks
// human enough to keep, false when it should be dropped.
// ------------------------------------------------------------

// Honeypot: the form carries a "website" field that humans
// never see (it is positioned off-screen and marked aria-hidden),
// so humans leave it empty. Form-filling bots fill every field
// they find, including that one.
function passesHoneypot(data) {
  return !data.website;
}

// Fill time: the page stamps the moment the form was rendered
// into a hidden field. A submission that arrives faster than a
// person could type, or with no stamp at all, is a bot replaying
// the endpoint directly.
function passesTiming(data) {
  const started = Number(data.formStartedAt);
  if (!started) return false;
  return Date.now() - started >= MIN_FILL_MS;
}

// Turnstile: when a secret is configured AND the page sent a
// token, ask Cloudflare to verify the token server-side. When
// the widget could not load on the page (offline, ad blocker),
// no token arrives; in that case we let the honeypot and timing
// checks decide rather than locking a real visitor out. When no
// secret is configured at all, this check is skipped entirely.
async function passesTurnstile(data, env, request) {
  if (!env.TURNSTILE_SECRET) return true;
  const token = data.turnstileToken;
  if (!token) return true;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);
  const resp = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form }
  );
  const outcome = await resp.json();
  return outcome.success === true;
}

// ------------------------------------------------------------
// Field validation. The form and this Worker agree on the same
// rules as the original Squarespace form: first name, last name,
// email and message are required; phone is optional; the
// newsletter checkbox is just a flag.
// ------------------------------------------------------------

function validate(data) {
  const firstName = String(data.firstName || "").trim();
  const lastName = String(data.lastName || "").trim();
  const email = String(data.email || "").trim();
  const phone = String(data.phone || "").trim();
  const message = String(data.message || "").trim();
  if (!firstName || !lastName || !email || !message) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  // Length caps keep a single submission from becoming a novel
  // (or a storage attack) in the database.
  if (firstName.length > 100 || lastName.length > 100) return null;
  if (email.length > 200 || phone.length > 50) return null;
  if (message.length > 5000) return null;
  return {
    firstName,
    lastName,
    email,
    phone,
    message,
    newsletter: data.newsletter ? 1 : 0,
  };
}

// ------------------------------------------------------------
// The notification email. Built as a plain-text MIME message by
// hand so the Worker needs no libraries. Reply-To is the
// visitor's own address, so Maya can simply hit Reply.
// ------------------------------------------------------------

function buildEmail(fields) {
  const name = cleanHeader(fields.firstName + " " + fields.lastName);
  const replyTo = cleanHeader(fields.email);
  const lines = [
    "From: " + FORM_FROM,
    "To: " + DESTINATION_EMAIL,
    "Reply-To: " + replyTo,
    "Subject: Website contact form: " + name,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "",
    "New message from the contact form on Maya's website.",
    "",
    "Name: " + fields.firstName + " " + fields.lastName,
    "Email: " + fields.email,
    "Phone: " + (fields.phone || "(not given)"),
    "Sign up for news and updates: " + (fields.newsletter ? "yes" : "no"),
    "",
    "Message:",
    fields.message,
    "",
  ];
  return lines.join("\r\n");
}

// ------------------------------------------------------------
// The Worker itself.
// ------------------------------------------------------------

export default {
  async fetch(request, env) {
    // CORS preflight: the browser asks permission before the
    // real POST. Only the site's own origin gets a yes.
    if (request.method === "OPTIONS") {
      if (request.headers.get("Origin") !== ALLOWED_ORIGIN) {
        return json({ ok: false, error: "Forbidden" }, 403);
      }
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    // A browser POST always carries an Origin header. If one is
    // present and it is not the site, this is not our form.
    const origin = request.headers.get("Origin");
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }

    let data;
    try {
      data = await request.json();
    } catch (err) {
      return json({ ok: false, error: "Malformed submission" }, 400);
    }

    // Spam drops pretend to succeed. Telling a bot "it worked"
    // gives it nothing to adapt to, and the human behind a real
    // form never sees these paths anyway.
    if (!passesHoneypot(data) || !passesTiming(data)) {
      return json({ ok: true });
    }

    // A failed Turnstile verification is different: that is a
    // real browser that sent a bad token, so answer honestly
    // and let the page show an error.
    if (!(await passesTurnstile(data, env, request))) {
      return json(
        { ok: false, error: "Verification failed, please try again" },
        400
      );
    }

    const fields = validate(data);
    if (!fields) {
      return json(
        { ok: false, error: "Please fill in every required field" },
        400
      );
    }

    // Save FIRST, email second. The database row is the safety
    // net: even if email is not configured yet, or sending
    // fails, the message itself is never lost.
    const inserted = await env.DB.prepare(
      "INSERT INTO submissions (created_at, name, email, phone, message, newsletter, emailed) VALUES (?, ?, ?, ?, ?, ?, 0)"
    )
      .bind(
        new Date().toISOString(),
        fields.firstName + " " + fields.lastName,
        fields.email,
        fields.phone,
        fields.message,
        fields.newsletter
      )
      .run();

    if (DESTINATION_EMAIL) {
      try {
        const raw = buildEmail(fields);
        await env.EMAIL.send(
          new EmailMessage(FORM_FROM, DESTINATION_EMAIL, raw)
        );
        await env.DB.prepare(
          "UPDATE submissions SET emailed = 1 WHERE id = ?"
        )
          .bind(inserted.meta.last_row_id)
          .run();
      } catch (err) {
        // Leave emailed = 0 so the unsent row is easy to find
        // later; the visitor still gets their thank-you, because
        // from their side the message WAS received and saved.
      }
    }

    return json({ ok: true });
  },
};
