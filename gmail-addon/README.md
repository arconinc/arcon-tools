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

**Option B — Install for the whole organization (Workspace-wide):**

This allows all users in your Google Workspace to use the add-on without individual installation.

1. **Deploy the add-on** (if not already deployed):
   - In Apps Script, click **Deploy** → **New deployment**
   - Type: **Gmail Add-on**
   - Click **Deploy**
   - Copy the **Deployment ID**

2. **Open Google Workspace Admin Console**:
   - Go to [admin.google.com](https://admin.google.com)
   - Sign in as a Workspace admin

3. **Navigate to Google Workspace Marketplace**:
   - Left sidebar: **Apps** → **Google Workspace Marketplace apps**
   - Click **Create/Manage custom apps**

4. **Create the custom app listing**:
   - Click **Create app**
   - Select **Web app**
   - Fill in:
     - **App name:** `The Arc`
     - **Description:** `Create CRM tasks in The Arc directly from Gmail. Includes email context (subject, sender, body, thread link) and smart defaults for category, priority, and due date.`
     - **Icon URL:** `https://thearc.arconinc.com/the-arc-icon.png`
     - **Organization:** `Arcon Solutions`
     - **Support URL:** `https://thearc.arconinc.com/help`
   - Click **Continue**

5. **Paste the Deployment ID**:
   - Scroll to **Deployment ID** field
   - Paste the ID from step 1
   - Click **Create app listing**

6. **Configure app scope** (who can use it):
   - Select your newly created app
   - Go to **Installation settings**
   - Choose:
     - **Organization units** → select all departments or specific org units
     - **Installation:** **Automatic** (recommended) or **Manual**
       - **Automatic:** All users get it without asking; can be hidden from launcher
       - **Manual:** Users install from Marketplace; takes opt-in adoption

7. **Verify installation**:
   - Wait 5–10 minutes for propagation
   - Users will see "The Arc" in their Gmail sidebar (top right)
   - Open any email → click The Arc icon → should see the home card

8. **Monitor adoption** (optional):
   - In Admin Console: **Apps** → check "The Arc" usage metrics

---

## Workspace Installation Notes

- **Propagation time:** Changes take 5–10 minutes to sync across the Workspace
- **User experience:** Users can hide/show the sidebar icon via Gmail settings
- **Offline access:** The add-on requires internet (API calls to The Arc)
- **Permission changes:** If you modify OAuth scopes in `appsscript.json`, users must re-authorize the next time they use it
- **Support:** Users can contact your admin or check The Arc dashboard (thearc.arconinc.com) for questions

---

## Design Notes

The home card and form use **Arcon brand colors**:
- **Primary:** `#6b1e98` (deep purple) — defined in `appsscript.json`
- **Secondary:** `#f3e8ff` (light purple) — used in highlights
- **Logo:** Dedicated app icon at `https://thearc.arconinc.com/the-arc-icon.png` — shown in header

The UI includes:
- **Email context display:** Subject, sender, body snippet (first 300 chars)
- **Smart defaults:** Auto-assigns to you, 3-day due date, "To Do General" category, medium priority
- **Task creation form:** Multi-section layout (Details → Organization → Timeline)
- **Success feedback:** Confirmation card with next-step buttons

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

## Customization & Branding

The add-on is fully branded with Arcon colors and logo. To update branding:

1. **Colors:** Edit `appsscript.json`:
   ```json
   "primaryColor": "#6b1e98",      // Arcon purple
   "secondaryColor": "#f3e8ff"     // Light purple
   ```

2. **Logo:** Update in three places:
   - `appsscript.json`: `"logoUrl"`
   - `Code.gs`: All card headers use `setImageUrl('https://thearc.arconinc.com/the-arc-icon.png')`

3. **App name & descriptions:** Edit in:
   - `appsscript.json`: `"name": "The Arc"`
   - Card headers throughout `Code.gs`
   - Google Workspace Marketplace listing (see workspace installation)

---

## Adding New Features

To add a new action to the add-on (e.g., "Link to Opportunity", "Email Task Report", etc.):

1. **Add a button** in `buildHomeCard()` section under "Actions":
   ```javascript
   actionSection.addWidget(
     CardService.newTextButton()
       .setText('🔗 Link to Opportunity')
       .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
       .setOnClickAction(CardService.newAction().setFunctionName('showLinkOpportunityForm'))
   );
   ```

2. **Write handler functions**:
   - `showLinkOpportunityForm(e)` — displays the form
   - `handleLinkOpportunity(e)` — submits the action

3. **Add backend support** (if needed):
   - Create an API route: `src/app/api/addon/opportunities/route.ts`
   - Use `requireAddonUser(req)` from `src/app/api/addon/auth.ts` for auth
   - Return JSON response

4. **Testing**:
   - Test in Apps Script editor: **Deploy** → **Test deployments** → **Install**
   - Open Gmail → click The Arc icon → test the new button
   - Check browser console for any errors (via Gmail → right-click → Inspect)

### Example: Add "Email Task Report" Button

In `Code.gs`:
```javascript
// In buildHomeCard(), within actionSection:
actionSection.addWidget(
  CardService.newTextButton()
    .setText('📊 Email Task Report')
    .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
    .setOnClickAction(
      CardService.newAction()
        .setFunctionName('showEmailReportForm')
    )
);

// New handler function:
function showEmailReportForm(e) {
  var section = CardService.newCardSection()
    .setHeader('Email Task Report')
    .addWidget(
      CardService.newTextParagraph()
        .setText('Send a summary of your tasks via email.')
    );
  
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Email Task Report'))
    .addSection(section)
    .build();
}
```

---

## Monitoring & Troubleshooting

### Check if add-on is working
1. In Gmail, click the extension icon (puzzle piece) in top right
2. Search for "The Arc"
3. If you see it listed, it's installed
4. Click it → should see the home card

### Users can't see the add-on
- **Individual install:** Ensure they installed it in their test deployment
- **Workspace-wide:** Check Google Workspace Admin Console → verify app is enabled for their org unit
- **Cache issue:** Reload Gmail or clear browser cache

### API errors in the add-on
1. Open Gmail → click The Arc icon
2. Right-click the sidebar → **Inspect**
3. Open **Console** tab
4. Try an action (e.g., "Create CRM Task")
5. Check for error messages
6. Common issues:
   - **"ARC_API_KEY is not set"** — Script Properties missing the key
   - **"Unauthorized"** — User email not found in Arc users table
   - **"Arc API error (401)"** — Invalid API key in Script Properties

### Reset authorization
- Users: Gmail settings → Plugins → find "The Arc" → click options (⋮) → Remove
- Workspace: Admin Console → Apps → disable/re-enable the app

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
