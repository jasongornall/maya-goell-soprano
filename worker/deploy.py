#!/usr/bin/env python3
"""Deploy the maya-goell-contact Worker and manage its secret.

WHY this exists: the Cloudflare connector helper (cf-api) speaks
JSON only, and uploading a Worker needs a multipart request. This
script does that upload the same way the Help the Many registry
tool does, using the connector's stored credential (a surrogate
the runtime swaps for the real token on api.cloudflare.com).
The credential value itself is never read or printed here.

Usage:
  deploy.py deploy
      Upload worker.js (next to this script) as the Worker
      "maya-goell-contact", with its D1 and email bindings, and
      make sure its workers.dev address is switched on.
      Prints the live URL at the end.

  deploy.py set-turnstile-secret <file>
      Read a Turnstile secret from <file> (a plain text file
      containing only the secret) and store it in the Worker's
      secret store as TURNSTILE_SECRET. The value is never
      printed. Delete the file afterwards. Secrets set this way
      survive later `deploy` runs: the upload replaces the
      declared bindings (D1, email) but never touches the
      secret store.

Binding note, learned on the registry Worker: the bindings sent
with an upload REPLACE the declared bindings, so both bindings
below must be resent verbatim on every deploy or they are dropped.
"""
import json
import sys
import urllib.request
import uuid

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
import dynamic_credentials as dc

ACCT = "2508c45a75fae136c0365c0d6b4d242c"
SCRIPT = "maya-goell-contact"
DB_ID = "91a8ebc6-dafd-44b1-83ac-12a9b6389062"  # D1 "maya-goell-contact"
API = "https://api.cloudflare.com/client/v4"
BASE = f"/accounts/{ACCT}/workers/scripts/{SCRIPT}"
HERE = __file__.rsplit("/", 1)[0]

BINDINGS = [
    {"name": "DB", "type": "d1", "database_id": DB_ID},
    {"name": "EMAIL", "type": "send_email"},
]


def req(method, path, data=None, content_type=None):
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("Accept", "application/json")
    if content_type:
        r.add_header("Content-Type", content_type)
    dc.add_surrogate_to_request(
        r, "custom.cloudflare", entry_name="access_token",
        allowed_hosts=("api.cloudflare.com",),
    )
    return r


def call(method, path, data=None, content_type=None):
    try:
        with urllib.request.urlopen(
            req(method, path, data, content_type), timeout=120
        ) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode("utf-8", errors="replace"))


def deploy():
    metadata = {
        "main_module": "worker.js",
        "bindings": BINDINGS,
        "compatibility_date": "2025-01-15",
    }
    src = open(HERE + "/worker.js", "rb").read()
    boundary = "----muse" + uuid.uuid4().hex
    parts = []
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; "
        f'name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode()
        + json.dumps(metadata).encode() + b"\r\n"
    )
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; "
        f'name="worker.js"; filename="worker.js"\r\n'
        f"Content-Type: application/javascript+module\r\n\r\n".encode()
        + src + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    out = call(
        "PUT", BASE, data=b"".join(parts),
        content_type=f"multipart/form-data; boundary={boundary}",
    )
    print("deploy success:", out.get("success"), "| errors:", out.get("errors"))
    if not out.get("success"):
        raise SystemExit(1)
    sub = call(
        "POST", BASE + "/subdomain",
        data=json.dumps({"enabled": True}).encode(),
        content_type="application/json",
    )
    print("workers.dev enabled:", sub.get("success"),
          "| errors:", sub.get("errors"))
    print("live at: https://maya-goell-contact.gornall-jason.workers.dev")


def set_turnstile_secret(path):
    with open(path) as f:
        secret = f.read().strip()
    if not secret:
        print("secret file is empty")
        raise SystemExit(1)
    body = {"name": "TURNSTILE_SECRET", "text": secret, "type": "secret_text"}
    out = call(
        "PUT", BASE + "/secrets",
        data=json.dumps(body).encode(),
        content_type="application/json",
    )
    # The response carries the secret's name and type only, never
    # its value, so printing success/errors is safe.
    print("secret stored:", out.get("success"),
          "| errors:", out.get("errors"))
    if not out.get("success"):
        raise SystemExit(1)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "deploy":
        deploy()
    elif cmd == "set-turnstile-secret" and len(sys.argv) == 3:
        set_turnstile_secret(sys.argv[2])
    else:
        print(__doc__)
        raise SystemExit(2)
