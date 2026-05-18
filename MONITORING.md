# Launch-Day Monitoring — Arcon Tools App

Audience: the person on call for thearc.arconinc.com on launch day or after a deploy.
Scale assumption: fewer than 10 concurrent users. No Sentry, no external APM — use the tools already wired in.

---

## 1. Where to Look

| What | Where | Notes |
|---|---|---|
| Function errors / crashes | Vercel → project → **Logs** tab | Filter by `ERROR` or paste a route path |
| Cron execution | Vercel → project → **Cron Jobs** tab | Shows last run status + response code |
| Supabase DB / Auth / Storage | Supabase dashboard → **Logs** (API, Auth, Storage tabs) | Default 7-day retention |
| Email delivery (Resend) | resend.com → **Emails** tab | Per-message status + error detail |
| In-app notification failures | Supabase → **Table Editor** → `notifications` | `email_status = 'failed'` rows |
| Lure order submissions | Supabase → `crm_tasks` (filter `category = Sales`) + `crm_task_comments` | Comment records the email send result |
| Audit events | Supabase → `audit_logs` | Login events, impersonation starts |

---

## 2. What to Watch

### 2.1 Vercel Function Errors

**Alert threshold:** any 5xx response in the Logs tab is worth a look.

Steps:
1. Open Vercel → project → **Logs**
2. Set filter to `Status: 5xx` or search for `ERROR`
3. Click the log line to expand — the full stack trace is there
4. Common causes: missing env var, Supabase down, Resend API key expired

**Auth callback specifically** (`/auth/callback`):
- A `?error=auth_failed` redirect means `exchangeCodeForSession` failed — usually a stale OAuth code (safe to ignore if it happens once) or the Supabase project is paused
- A `?error=unauthorized_domain` means someone with a non-`@arconinc.com` email hit the form — expected, not an incident

### 2.2 Cron Sync Failures (`/api/cron/sync-orders`)

Schedule: daily at 06:00 UTC (from `vercel.json`).

**Where:** Vercel → **Cron Jobs** tab.

**Alert threshold:** response code ≠ 200, or `synced` field in the response body is 0 when you expect orders.

Indicators in Vercel logs:
```
Cron: order upsert error for store <id>: ...
Cron: failed to sync orders for store <id>: ...
```

Steps if it fails:
1. Check `PROMOBULLIT_AUTH` env var is still valid (admin → Settings → Environment Variables)
2. Manually trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://thearc.arconinc.com/api/cron/sync-orders`
3. If Supabase is the problem, check the Supabase dashboard API logs for 5xx

### 2.3 Public Lure Order Failures (`/api/public/lure-order`)

**Where:** Vercel Logs filtered to `/api/public/lure-order` + Supabase `crm_tasks` table.

**Alert threshold:** a user reports submitting the form but receives no confirmation email, OR no new task appears in `crm_tasks`.

Log markers in Vercel:
```
Lure order submission error: ...          ← whole submission failed
Confirmation email failed: ...            ← task created but email didn't send
```

Recovery:
1. If task exists in `crm_tasks` but no email — send manually from the task detail; the `crm_task_comments` row will say `Confirmation email FAILED to send to <email>`.
2. If task does not exist — the submission errored before DB write; the submitter saw a 500. Ask them to resubmit after the fix is deployed.

### 2.4 Auth Callback Failures

**Where:** Vercel Logs → filter path `/auth/callback`.

Normal vs. incident:

| Redirect | Meaning | Action |
|---|---|---|
| `/login?error=unauthorized_domain` | Non-Arcon email tried to log in | None — expected |
| `/login?error=auth_failed` | Google OAuth exchange failed | Check Supabase Auth → Logs; verify Google OAuth app is not paused |
| Loop back to `/login` repeatedly | Session cookie not being set | Check `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_ANON_KEY` env vars |

### 2.5 Supabase Storage / API Errors

**Where:** Supabase dashboard → **Logs** → API Logs + Storage Logs.

**Alert threshold:** HTTP 503 or error rate spike in API logs.

Common causes:
- Project is paused (free-tier auto-pause after inactivity) → click **Restore** in the Supabase dashboard
- `lure-artwork` storage bucket missing → the lure order route calls `ensureBucket()` on every request, so this self-heals on the next submission
- Storage policy blocking uploads → check bucket policies under Storage → Policies

### 2.6 Email Notification Failures

**Where:** Supabase `notifications` table + Resend dashboard.

Check:
```sql
-- In Supabase SQL editor
SELECT type, count(*), email_status
FROM notifications
WHERE created_at > now() - interval '24 hours'
GROUP BY type, email_status
ORDER BY email_status;
```

**Alert threshold:** more than a handful of `failed` rows within a short window.

Steps:
1. Open Resend → **Emails** — look for delivery failures or bounces
2. Check `RESEND_API_KEY` and `RESEND_FROM_EMAIL` env vars in Vercel
3. Resend free tier has a 100 emails/day limit — confirm you haven't hit it

---

## 3. Rollback Steps

### 3.1 Instant rollback via Vercel

1. Vercel → project → **Deployments**
2. Find the last known-good deployment (the one before today's deploy)
3. Click `⋯` → **Promote to Production**
4. Takes effect in ~30 seconds — no code change needed

### 3.2 Emergency: disable a feature without redeploying

Most features that touch external services (Resend, ClickUp, PromoBuillit) check env vars first. To disable:
- **Cron order sync:** set `PROMOBULLIT_AUTH` to a dummy value in Vercel env vars → redeploy. The route will return a 500 immediately without contacting the external API.
- **Email notifications:** set `RESEND_API_KEY` to empty → emails will fail silently but in-app notifications still work (the dispatch function catches errors per-recipient).
- **Lure order form:** the form lives at `/order/rapala-lure`. To take it offline without a code deploy, redirect that path in `vercel.json` to `/` temporarily.

### 3.3 Database rollback

If a Supabase migration caused data issues:
1. Supabase → **Database** → **Backups** (point-in-time restore on Pro plan, daily snapshots on free)
2. For schema-only issues: manually apply the inverse SQL in the Supabase SQL editor
3. All applied migrations are tracked in `supabase/migrations/` — diff against them to find what changed

### 3.4 Supabase project paused

Symptom: all API calls return 503, users can't log in.
Fix: Supabase dashboard → click **Restore project**. Takes 1–3 minutes. No data loss.

---

## 4. First 30 Minutes After a Deploy Checklist

- [ ] Vercel Logs — no new 5xx in the first 5 minutes
- [ ] `/dashboard` loads and shows the hero carousel + news feed
- [ ] Log in with a real `@arconinc.com` account (confirm the auth callback works)
- [ ] Submit a test lure order with a personal email (confirm task appears in CRM and email arrives)
- [ ] Check Vercel Cron Jobs tab — cron job is still shown as scheduled

---

## 5. Contacts and Escalation

| Issue | Who |
|---|---|
| Supabase project paused or DB error | Check dashboard first; contact Supabase support if project is broken |
| Resend deliverability | resend.com support or switch `RESEND_FROM_EMAIL` to a verified sender |
| Google OAuth broken | Google Cloud Console → Credentials → check OAuth 2.0 Client |
| Vercel build fails | Check build logs; `npm run build` locally reproduces the error |
