# Access Setup — agenticapps-roadmap

Console-only runbook for the out-of-band configuration that the live data path
(`/api/linear/*`) depends on. None of these steps touch code or git — they are
performed in the Cloudflare dashboard and (for the secret binding) optionally in
CI. No secret value is ever committed.

---

## 1. Set the LINEAR\_API\_KEY Pages Secret Binding

The proxy handler (`functions/api/linear/[[path]].ts`) reads the token as
`context.env.LINEAR_API_KEY`. This is a **Pages secret binding** — encrypted at
rest in Cloudflare, injected at runtime only into the Function isolate, and
never exposed to the client bundle, `roadmap.json`, `wrangler.toml`, or any
response body.

**The binding name must be `LINEAR_API_KEY` exactly** — this is the same name
used for the existing GitHub Actions secret (CI snapshot) and matches the
`context.env.LINEAR_API_KEY` reference in the handler. Do not rename it.

### Steps (Cloudflare dashboard)

1. Open **Cloudflare Dashboard → Pages → agenticapps-roadmap → Settings →
   Environment Variables**.
2. Under **Production** (and optionally **Preview**), click **Add variable**.
3. Set **Variable name** to `LINEAR_API_KEY`.
4. Paste the API key value and check **Encrypt** (marks it as a secret binding).
5. Save. Redeploy the Pages project so the new binding takes effect.

> **Never-commit rule:** Do not put the token in `wrangler.toml`, any
> `*.json` file, the client bundle, or any git-tracked file. The CI grep gate
> (`grep -r "lin_api_"`) enforces this; any `lin_api_`-prefixed string in
> tracked files blocks the build.

### Local development (wrangler pages dev)

For local live-mode testing with `wrangler pages dev`, create a gitignored
`.dev.vars` file at the repo root:

```
LINEAR_API_KEY=lin_api_<your key here>
```

`.dev.vars` and `.wrangler/` are already gitignored (added in plan 03-02).
Do not add them again. The local smoke commands are:

```bash
pnpm build
npx --yes wrangler@4 pages dev dist
```

Then verify `GET http://localhost:8788/api/linear/snapshot` returns 200 and
`GET http://localhost:8788/api/linear/nope` returns 404. This local check runs
**without** Cloudflare Access enforcement — Access only applies on the deployed
app.

---

## 2. Create the Cloudflare Access Email Allow-List Policy

Cloudflare Access is the **primary authentication control** for this app. It
gates reachability at the edge before any Function or static asset is served.
The policy must cover **two targets**:

1. The Pages project domain (the entire app).
2. The `/api/*` path explicitly.

**Omitting the `/api/*` path-level rule leaves the proxy open.** Even if the
app root is gated, a direct request to `https://<domain>/api/linear/snapshot`
without an Access session will reach the Function and be served — bypassing the
authentication gate entirely. Both targets are required.

### Steps (Cloudflare dashboard)

1. Open **Cloudflare Zero Trust → Access → Applications → Add an application**.

#### 2a. Gate the Pages project (app-level)

2. Choose **Self-hosted** and point it at your Pages domain
   (e.g. `agenticapps-roadmap.pages.dev` or your custom domain). Set the
   **Session duration** to something appropriate (e.g. 24 hours).
3. Under **Policies**, add an **Allow** policy. Set **Action = Allow** and add
   an **Include** rule:
   - **Selector:** `Emails`
   - **Value:** the list of allowed email addresses (named allow-list, one
     per line or comma-separated depending on the UI version).
4. Save the application.

#### 2b. Gate the /api/\* path (path-level)

5. In the same application (or as a second application with the same domain),
   add a **Path** entry: `/api/*`.

   If the Cloudflare UI supports path-scoped policies within one application,
   add `/api/*` as an additional path on the same application created above.
   If it requires a separate application, create a second **Self-hosted**
   application for the same domain with **Path** set to `/api/*` and apply
   the same **Allow** email policy.

6. Confirm both the root domain and `/api/*` show the same Allow policy before
   proceeding.

> **Why explicitly cover `/api/*`:** The Cloudflare Access STRIDE analysis
> (T-03-13) identifies "unauth access to /api/*" as a Spoofing threat. The
> per-isolate rate limiter already shipped in the Function is defense-in-depth
> only. Access is the primary gate, and it must cover the path, not just the
> domain root.

### Verify the policy is live

After saving, open a **private browser window** (no existing Access session)
and navigate to `https://<deployed-domain>/api/linear/snapshot`. You should be
redirected to the Cloudflare Access login page or receive a `403`. You should
**not** receive a `200` or any Linear data. This is the unauthenticated-blocked
check that must be recorded in `.planning/phases/03/03-ACCESS-PROOF.md`
(see §4 below).

---

## 3. Optional: Dashboard Rate-Limit Rule for /api/\*

This step is **optional** and provides defense-in-depth on top of:

- The Cloudflare Access allow-list (primary control — a small, named set of
  identities).
- The per-isolate fixed-window rate limiter already in the Function (30
  requests per 60 seconds per isolate, no KV/Durable Object).

If you want an additional edge-level rate limit:

1. Open **Cloudflare Dashboard → your zone → Security → WAF → Rate limiting
   rules** (exact path varies by plan tier).
2. Create a rule matching `http.request.uri.path matches "^/api/"`.
3. Set a threshold appropriate for your audience (e.g. 60 requests per minute
   per IP).
4. Action: **Block** or **Managed Challenge**.

This rule applies at the Cloudflare network layer before the Function runs.
It is not required for the phase to be complete — Access + the in-Function
limiter are sufficient for a small allow-list audience.

---

## 4. Verify and Record Proof

### Local smoke (does not test Access enforcement)

```bash
pnpm build
npx --yes wrangler@4 pages dev dist
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/api/linear/snapshot
# expect: 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/api/linear/nope
# expect: 404
```

Access does not apply locally — the `200` here confirms the binding and handler
work, not that Access is enforced.

### Deployed Access check (required — blocking gate)

These checks must be run against the **deployed Pages app** (not localhost):

```bash
# Unauthenticated check (no Access session):
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/linear/snapshot
# expect: 302 (redirect to Access login) or 403 — NOT 200, NOT any Linear data

# Allowed-identity check (after authenticating as an allow-listed email):
# Use a browser session authenticated through Access, or a Cloudflare Access
# Service Token with the appropriate headers. Then:
curl -sS -H "CF-Access-Client-Id: <service-token-id>" \
         -H "CF-Access-Client-Secret: <service-token-secret>" \
         -o /dev/null -w "%{http_code}\n" \
         https://<deployed-domain>/api/linear/snapshot
# expect: 200
```

Record both results — the unauthenticated status code (blocked) and the
allowed-identity status code (200) — in `.planning/phases/03/03-ACCESS-PROOF.md`.
That file is the **phase-completion artifact** for "Done when #2":
unauthenticated requests are blocked by Access. Phase 03 is not complete until
`03-ACCESS-PROOF.md` records a blocked unauthenticated result and a successful
allowed-identity result with no Linear data or token in the blocked response.
