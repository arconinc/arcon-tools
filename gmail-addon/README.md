# Arc Gmail Add-On

A Gmail Add-On that lets Arcon team members create CRM tasks in The Arc directly from their inbox.

## Features

- **Create CRM Task from Email** — opens a form pre-filled with the email subject, sender, body snippet, and a link back to the Gmail thread. Defaults to assigning the task to yourself with "To Do General" category, medium priority, and a due date 3 business days out.

## Architecture

```
Gmail (Apps Script add-on)
       │  HTTPS + API key
       ▼
The Arc API (/api/addon/*)
       │  createAdminClient()
       ▼
Supabase (crm_tasks, users)
```

**Auth:** The add-on sends `Authorization: Bearer <ARC_API_KEY>` + `X-User-Email: <gmail user>` on every request. The Arc API verifies the key against the `ADDON_API_KEY` env var and looks up the user by email.

---

## One-Time Setup

### 1. Set ADDON_API_KEY in Vercel

The key is already in `.env.local`. Add it to your Vercel project:

```
ADDON_API_KEY=9cd69c08bf7cbde78644a3575614ead8a42eb6b2281a970abfe126661a3eb64f
```

Go to Vercel → Project → Settings → Environment Variables → add `ADDON_API_KEY`.

### 2. Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com) and click **New project**
2. Name it `Arc Gmail Add-On`
3. Delete the default `Code.gs` content

### 3. Add the source files

Copy the contents of each file below into the Apps Script editor:

| Local file | Apps Script file |
|---|---|
| `gmail-addon/appsscript.json` | Click **Project Settings** → paste into the manifest (enable "Show appsscript.json manifest file in editor" first) |
| `gmail-addon/Config.gs` | Create a new script file named `Config` |
| `gmail-addon/Code.gs` | Paste into the default `Code.gs` |

### 4. Set Script Properties

In Apps Script: **Project Settings** → **Script properties** → **Add script property**:

| Property | Value |
|---|---|
| `ARC_API_KEY` | `9cd69c08bf7cbde78644a3575614ead8a42eb6b2281a970abfe126661a3eb64f` |

> Keep this value secret — it grants write access to the CRM.

### 5. Deploy as a Gmail Add-On

1. Click **Deploy** → **New deployment**
2. Type: **Gmail Add-on**
3. Click **Deploy**
4. Copy the **Deployment ID**

### 6. Install for your Google Workspace

**Option A — Install for yourself only (testing):**
1. In Apps Script, click **Deploy** → **Test deployments**
2. Click **Install** next to "Gmail Add-on"
3. Open Gmail — the Arc icon appears in the right sidebar

**Option B — Install for the whole organization:**
1. Go to [Google Workspace Admin Console](https://admin.google.com)
2. Apps → Google Workspace Marketplace apps → **Add app** → **Add custom app**
3. Paste the Deployment ID

---

## Testing the API Locally

Before deploying the add-on, verify the API endpoints work:

```bash
# List users
curl http://localhost:3000/api/addon/users \
  -H "Authorization: Bearer 9cd69c08bf7cbde78644a3575614ead8a42eb6b2281a970abfe126661a3eb64f" \
  -H "X-User-Email: you@arconinc.com"

# Create a task
curl -X POST http://localhost:3000/api/addon/tasks \
  -H "Authorization: Bearer 9cd69c08bf7cbde78644a3575614ead8a42eb6b2281a970abfe126661a3eb64f" \
  -H "X-User-Email: you@arconinc.com" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test from Gmail","category":"To Do General","priority":"medium","due_date":"2026-04-03"}'
```

---

## Adding New Features

To add a new action to the add-on (e.g., "Link to Opportunity"):

1. **Add a button** in `buildHomeCard()` in `Code.gs`
2. **Write a handler function** (e.g., `showLinkOpportunityForm`, `handleLinkOpportunity`)
3. **Add an API route** if needed: `src/app/api/addon/<feature>/route.ts` — use `requireAddonUser()` from `src/app/api/addon/auth.ts`

The `buildHomeCard()` function has a comment block showing exactly where to add new buttons.

---

## File Reference

| File | Purpose |
|---|---|
| `gmail-addon/appsscript.json` | Add-on manifest (OAuth scopes, triggers) |
| `gmail-addon/Config.gs` | API base URL, category/priority constants |
| `gmail-addon/Code.gs` | All UI cards and action handlers |
| `src/app/api/addon/auth.ts` | Shared API key auth helper |
| `src/app/api/addon/users/route.ts` | `GET /api/addon/users` |
| `src/app/api/addon/tasks/route.ts` | `POST /api/addon/tasks` |
