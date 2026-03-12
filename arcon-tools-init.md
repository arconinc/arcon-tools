PROJECT: Arcon Tools - Store Management Dashboard
OBJECTIVE
Build a mobile-first web application to manage multiple e-commerce stores via the PromoBullit EStore Platform REST API. The app will serve as an internal operations dashboard allowing Arcon staff to select a store, manage orders, customers, and configuration, and perform common tasks such as adding shipment tracking numbers and sending customer notification emails. The app is designed to grow incrementally, starting with core order tracking functionality and expanding to cover full store management over time.

TECH STACK
* Next.js 15+ with App Router
* TypeScript
* Tailwind CSS for styling (mobile-first)
* Supabase for PostgreSQL database and authentication
* Vercel for deployment
* Google OAuth 2.0 via Google Workspace (Arcon's internal Google Workspace — no public sign-in)
* PromoBullit EStore Platform REST API as the data source for stores, orders, customers, and configuration

GOOGLE WORKSPACE OAUTH SETUP (DO NOT SKIP — REQUIRED BEFORE BUILDING)
Arcon uses Google Workspace. Follow these steps to configure OAuth so that only @arcon.com (or your domain) accounts can log in.

Step 1: Create a Google Cloud Project
1. Go to https://console.cloud.google.com
2. Create a new project (e.g., "Arcon Tools")
3. Select the project

Step 2: Configure the OAuth Consent Screen
1. In the left menu go to "APIs & Services" > "OAuth consent screen"
2. Select User Type: "Internal" — this restricts login to users within your Google Workspace organization only. No external Google accounts can log in.
3. Fill in App name (e.g., "Arcon Tools"), User support email, and Developer contact email
4. Click Save and Continue through the Scopes and Test Users screens (no changes needed for Internal apps)

Step 3: Create OAuth Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: "Web application"
4. Name: "Arcon Tools Web"
5. Authorized JavaScript origins: add your Vercel domain (e.g., https://arcon-tools.vercel.app) and http://localhost:3000 for local dev
6. Authorized redirect URIs: add the Supabase OAuth callback URL — format is: https://[your-supabase-project-ref].supabase.co/auth/v1/callback
7. Click Create — copy the Client ID and Client Secret

Step 4: Configure Supabase Google Provider
1. In your Supabase dashboard go to Authentication > Providers > Google
2. Enable the Google provider
3. Paste in the Client ID and Client Secret from Step 3
4. Save

Step 5: Add Environment Variables
Add to your .env.local (and Vercel dashboard):
  NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=[your-anon-key]

Because the consent screen is set to "Internal", only users within the Arcon Google Workspace domain can authenticate. No additional domain restriction code is needed, but optionally you can double-check the user's email domain server-side after login as a defense-in-depth measure.

PROMOBUILLIT API OVERVIEW
* Base URL: https://manage.promobullitstores.com/admin/rest2/1/stores/[Store-ID]
* Authentication: HTTP header "X-Auth-Credentials" containing a Base64-encoded string of "username:password"
  * Example header: X-Auth-Credentials: [base64 encoded username:password]
* The API user account must be created by the PromoBullit store admin with the necessary permissions
* Each store has a unique Store ID; this is required in every API request URL
* The API is a standard REST API supporting GET, POST, and PUT methods
* Pagination: use meta[pageSize]=100 (max 100 per page); response includes meta.recordsFound, meta.page, meta.pageSize
* Do NOT develop against live production stores — test against a dev/staging store first

KEY API ENDPOINTS USED IN PHASE 1
All endpoints are relative to: https://manage.promobullitstores.com

  List orders (filter by status):
    GET /admin/rest2/1/stores/[Store-ID]/orders?meta[pageSize]=100&status[]=new
    GET /admin/rest2/1/stores/[Store-ID]/orders?meta[pageSize]=100  (all orders)
    Supports search/filter by: status (new, approved, declined, etc.), pageSize, page offset
    Response fields per order: id, created, customerName, companyName, status, amount, details (URL)

  Get order detail:
    GET /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]
    Response includes: id, storeId, customerId, firstName, lastName, email (billingEmail / shippingEmail),
    telephone, status, amount, billingAddress*, shippingAddress*, shipments (URL), products (URL),
    payments (URL), priceComponents (URL)

  Get products for an order:
    GET /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]/products
    Response: id, productId, name, sku, quantity, shippedQuantity, subtotal

  Add a shipment to an order (POST — creates a new shipment record):
    POST /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]/shipments
    Content-Type: application/json
    Body: {"carrierId":"UPS","trackingNumber":"12345","trackingUrl":"www.ups.com","shipmentDate":"2024-01-15"}
    CAUTION: Calling POST repeatedly will create multiple shipment entries. Validate before submitting.
    Response: returns the new shipment ID (used to add products to the shipment)
    Supported carrierId values include: UPS, FedEx, CanadaPost, USPS, DHL — confirm full list with PromoBullit

  Add a product to a shipment:
    POST /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]/shipments/[Shipment-ID]/products
    Body: {"orderProductId":"[id]","quantity":"1"}

  Send a notification email for an order (PUT — separate call from adding shipment):
    PUT /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]
    Content-Type: application/json
    Body: {
      "id":"[Order-ID]",
      "status":"new",
      "notificationEmail":{
        "subject":"Order update (order #[Order-ID]).",
        "body":"<p>Dear [Customer Name],</p><p>Your order has been shipped! Your tracking number is: [Tracking Number]</p><p>Thank you!</p>",
        "sendDate":"now"
      }
    }
    Acceptable sendDate values: "now", "tomorrow", "+1 weeks", "+2 weeks"
    The body supports HTML. Text between </p> and <p> tags starts on a new line.
    NOTE: This is a SEPARATE API call from the shipment POST. Both calls must succeed for the workflow to complete.

  Get available products to ship (for a shipment):
    GET /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]/shipments/[Shipment-ID]/available-order-products

PROMOBUILLIT API CREDENTIAL MANAGEMENT
* The PromoBullit API requires a username and password that are separate from the app's Google login
* These credentials are per-user (or shared, depending on how PromoBullit accounts are configured)
* Credentials must be stored securely in Supabase (encrypted at rest) — never in environment variables or client-side code
* On first login (or when credentials are missing), the user is prompted to enter their PromoBullit username and password
* Credentials are stored in the app_credentials table (see Data Model below), encrypted using AES-256-GCM before storage
* The encryption key is stored in an environment variable (CREDENTIALS_ENCRYPTION_KEY) — never in the database
* Users can update their PromoBullit credentials at any time via a "My Settings" page
* When making API calls, the server decrypts the credentials, base64-encodes "username:password", and sets the X-Auth-Credentials header
* Credentials are never sent to the client — all API calls are server-side only

CORE REQUIREMENTS

1. Authentication and User Management
* Internal Arcon staff only — no self-registration; all login is via Google Workspace OAuth
* Because the Google Cloud OAuth consent screen is set to "Internal", only Arcon Google Workspace accounts can authenticate
* User roles: Staff (read/write access to tasks) and Admin (full access including user management and app configuration)
* Admins are flagged manually in the Supabase database after their first login
* All routes require authentication — redirect unauthenticated users to the login page
* Role-based UI: Admin-only features are hidden from regular Staff users
* On first login, create a user record in Supabase automatically from the Google profile (email, display name)

2. PromoBullit Credential Setup (First-Time Flow)
* After Google login, check if the user has saved PromoBullit credentials in the database
* If no credentials exist, show a credential setup screen before allowing access to any task
* Setup screen: two fields — PromoBullit Username, PromoBullit Password — with a save button
* Validate the credentials by making a test API call (e.g., list orders for any store) before saving
* On success, encrypt and save to the app_credentials table
* On failure, show a clear error and let the user retry
* A "My Settings" link in the nav allows users to update their credentials at any time
* When credentials are updated, re-validate before saving

3. Dashboard Layout and Navigation
* After login and credential setup, users land on a central dashboard showing a task card grid
* Each card represents a feature/task module (e.g., "Add Tracking Number", "Customer Lookup", "Order History")
* Navigation: persistent sidebar on desktop, hamburger menu on mobile
* Header displays: currently selected store name (or prompt to select), user avatar/name, settings link
* Task cards that are built show as active; future tasks display as "Coming Soon" in a disabled style
* Dashboard is the home page — all navigation returns here

4. Store Selection
* Users must select an active store before performing any task
* Store selector is accessible from the header at all times
* Since PromoBullit does not expose a "list all stores" API endpoint, the list of stores (Store ID + Store Name) is configured by an Admin in the app and stored in the Supabase stores table
* Admin can add, edit, and remove stores from the Admin panel
* Selected store is persisted in the user's session (Supabase session or cookie) — resets on logout
* Store name and Store ID are displayed in the header once selected
* If no store is selected, task pages show a prompt to select a store first

5. Task: Add Tracking Number to Order (Phase 1 Feature — Core Workflow)
This is a multi-step workflow:

  Step 1 — Select Store (required, enforced globally)

  Step 2 — Search for Order
  * Search input accepts: order number (ID), customer name, or email
  * On submit, call server-side API route → PromoBullit API:
    GET /admin/rest2/1/stores/[Store-ID]/orders?meta[pageSize]=100
    Filter results client-side or use status filter if searching by status
  * Display results in a list: order number, customer name, company, order date, status, amount
  * If no results, show "No orders found" message
  * User clicks an order to select it and proceed to Step 3

  Step 3 — View Order and Enter Tracking
  * Display order summary: order number, customer name, billing/shipping email, order status, line items (from /orders/[Order-ID]/products)
  * Tracking form:
    - Carrier dropdown: UPS, FedEx, USPS, DHL, Canada Post, Other (maps to PromoBullit carrierId values)
    - Tracking Number text input (required)
    - Tracking URL text input (optional — pre-filled based on carrier if possible)
    - Shipment Date (defaults to today)
  * Warn user: "Submitting will create a shipment record. Do not submit more than once for the same shipment."

  Step 4 — Submit Tracking and Send Email
  * On submit, execute in sequence (server-side):
    a. POST /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]/shipments
       Body: {carrierId, trackingNumber, trackingUrl, shipmentDate}
    b. If POST succeeds, PUT /admin/rest2/1/stores/[Store-ID]/orders/[Order-ID]
       Body: notificationEmail with subject, HTML body containing tracking number, sendDate: "now"
  * If Step a fails: show error, do NOT proceed to Step b, allow retry
  * If Step a succeeds but Step b fails: show partial success warning — "Shipment added but email failed to send. You can retry the email notification."
  * If both succeed: show success message with order number and customer email address
  * Log the action (both API calls, success/failure) to the audit_log table
  * "Add Tracking to Another Order" button resets to Step 2 without a full page reload

6. Admin Panel (Admin Role Only)
* Route-guarded: non-admins are redirected to the dashboard
* Store management: add, edit, delete stores (Store ID + Store Name stored in Supabase)
* User management: view all users, toggle is_admin flag
* Audit log viewer: paginated, filterable table (by user, store, action, date range)
* App configuration view: show environment variable status (masked), encryption key status

7. My Settings Page (All Users)
* Update PromoBullit credentials (username + password)
* Validate before saving
* Show last-updated timestamp for credentials

DATA MODEL (Supabase PostgreSQL)
Tables:

- users
  (id uuid PK, email text UNIQUE, display_name text, google_id text UNIQUE, is_admin boolean DEFAULT false, created_at timestamptz, last_login_at timestamptz)

- app_credentials
  (id uuid PK, user_id uuid FK → users.id UNIQUE, encrypted_username text, encrypted_password text, encryption_iv text, created_at timestamptz, updated_at timestamptz)
  Note: username and password are encrypted with AES-256-GCM before storage.
  The IV (initialization vector) is stored alongside the ciphertext (this is safe — IV is not a secret).
  The encryption key (CREDENTIALS_ENCRYPTION_KEY) is stored only in environment variables.

- stores
  (id uuid PK, store_id text UNIQUE NOT NULL, store_name text NOT NULL, is_active boolean DEFAULT true, created_at timestamptz, updated_at timestamptz)
  Note: This is the app's own registry of PromoBullit stores. store_id is the PromoBullit Store ID used in API URLs.

- audit_log
  (id uuid PK, user_id uuid FK → users.id, action text, store_id text, order_id text, details jsonb, status text ('success'|'error'|'partial'), created_at timestamptz)
  Note: Log every PromoBullit API action — what was attempted, the store and order context, and whether it succeeded.

Indexes:
- users.email (unique)
- users.google_id (unique)
- app_credentials.user_id (unique)
- stores.store_id (unique)
- audit_log.user_id
- audit_log.store_id
- audit_log.created_at

Notes:
- Store, order, customer, and product data all live in the PromoBullit API — do NOT cache or duplicate in Supabase
- Supabase is used only for: user authentication/roles, encrypted PromoBullit credentials, store registry, and audit logging
- Row Level Security (RLS): not required, keep auth simple — enforce access control at the Next.js middleware/route level

ENCRYPTION IMPLEMENTATION NOTES
* Use Node.js built-in crypto module (AES-256-GCM) — no third-party crypto library needed
* Encryption key: 32-byte random string stored in CREDENTIALS_ENCRYPTION_KEY environment variable
  * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
* Encryption flow (server-side only):
  1. Generate a random 12-byte IV for each encryption operation
  2. Encrypt the plaintext credential with AES-256-GCM using the key and IV
  3. Store: encrypted ciphertext (hex) + IV (hex) + auth tag (hex) in the database
* Decryption flow (server-side only):
  1. Retrieve encrypted ciphertext, IV, and auth tag from database
  2. Decrypt using the same key and IV
  3. Use the plaintext credential to build the base64 X-Auth-Credentials header
* Never log or expose plaintext credentials anywhere

PHASED DEVELOPMENT PLAN (DO NOT BUILD CODE YET - PLAN ONLY)

Phase 1: Foundation (Authentication, Google Workspace OAuth, Layout)
* Set up Next.js 15+ App Router project with Tailwind CSS and TypeScript
* Configure Supabase project and Google OAuth provider (using the Google Workspace setup steps above)
* Implement Google OAuth login flow via Supabase Auth — Google Workspace "Internal" consent screen means no domain filtering code needed, but add a server-side email domain check as defense-in-depth
* Create protected route middleware: all pages except /login require an authenticated session
* On first login, auto-create a user record in the Supabase users table from the Google profile
* Create basic layout: Header (store selector + user name + settings link), Sidebar nav (desktop), Hamburger menu (mobile), Main content area
* Create /login page with "Sign in with Google" button only
* Deliverable: Arcon staff can log in with their Google Workspace account; non-Arcon accounts are rejected

Phase 2: PromoBullit Credential Setup
* After login, middleware checks if the user has saved app_credentials in Supabase
* If no credentials: redirect to /setup-credentials before any other page
* Build /setup-credentials page: PromoBullit username + password fields, save button
* Server action: encrypt credentials with AES-256-GCM, make a test PromoBullit API call to validate, save to app_credentials if valid
* Build /settings page: allow users to update their PromoBullit credentials at any time, with re-validation before saving
* Show last-updated timestamp for credentials on the settings page
* Deliverable: Users can securely store and update their PromoBullit API credentials

Phase 3: Dashboard and Store Selection
* Build the main /dashboard page with a task card grid
* Task cards: icon, title, description, enabled/disabled state
* Wire up routing: active cards navigate to their task page; Coming Soon cards are non-clickable
* Build the Admin panel stub for store management (/admin/stores): add, edit, delete stores (store_id + store_name in Supabase stores table)
* Build store selector in the header: fetches stores from Supabase stores table, user picks one, persists in session
* If no store selected, show a "Please select a store" banner on task pages
* Deliverable: Dashboard renders, store selection works, admin can manage the store list

Phase 4: Order Search
* Build the Add Tracking task page at /tasks/add-tracking
* Step 1: enforce store selection (redirect if none selected)
* Step 2: order search form — text input for order number, customer name, or email
* Server action or API route: fetch from PromoBullit GET /orders with the selected store, filter results
* Display results: order number, customer name, company, date, status, amount
* Handle empty results and API errors gracefully with user-friendly messages
* User clicks an order to select it and advance to the next step
* Deliverable: Staff can search for and select an order within the selected store

Phase 5: Add Tracking Number and Send Email
* After order selection: display order summary (order details + line items from /orders/[id]/products)
* Tracking form: carrier dropdown, tracking number (required), tracking URL (optional, carrier-prefilled), shipment date (default today)
* Warn user about duplicate shipment risk before submission
* Server action — two sequential PromoBullit API calls:
  a. POST /shipments — add the shipment record
  b. PUT /orders/[id] with notificationEmail payload — send the email
* Handle three outcomes: full success, step-a failure (show error, do not send email), step-b failure after step-a (show partial success with retry option for email)
* Log both API calls to audit_log (status: success | error | partial)
* Show clear success message: "Tracking added and email sent to [customer email]"
* "Add Tracking to Another Order" resets to the search step
* Deliverable: Full tracking + email notification workflow is functional end-to-end

Phase 6: Admin Panel and Audit Log
* Build /admin routes with middleware guard (is_admin required, redirect others)
* User management: list all users, toggle is_admin flag
* Audit log viewer: paginated table with filters (user, store, action, status, date range)
* Store management: full CRUD for the Supabase stores table
* App configuration view: show environment variable health status (key present/missing, masked)
* Deliverable: Admins can manage users, stores, and review all logged actions

Phase 7: Error Handling, Polish, and Mobile Optimization
* Audit all API error paths — consistent, friendly error messages throughout
* Add loading skeletons on all data-fetching views
* Ensure full mobile responsiveness: touch-friendly inputs, readable text, accessible tap targets
* Add toast notifications for success/error in addition to inline messages
* Ensure the credential-missing flow interrupts gracefully at any page, not just on login
* Deliverable: App is polished and fully usable on phones and tablets

Phase 8: Expanding Task Modules (Future — Shown as Coming Soon)
The following task modules are planned for future phases and should appear as "Coming Soon" cards on the dashboard from Phase 3 onward:
* Customer Lookup: Search and view customer records, order history, customer group membership
* Order History: Browse and filter all orders for a store, with export capability
* Store Configuration: View and edit general store settings and display settings via PromoBullit API
* Inventory Management: Browse products, update inventory levels (PUT /products/[id]/inventory/[id])
* Discount Codes: View and manage discount codes for a store
* Email Logs: View store email logs via PromoBullit Customization API
* Reporting: Basic order and sales summary views

Each future module follows the same pattern: select store → perform task → log to audit_log.

Phase 9: Testing, Refinement, and Deployment
* Test all user flows: Google login, credential setup, store selection, order search, tracking submission, email send
* Test credential encryption/decryption round-trip
* Test both PromoBullit API call failure scenarios (step a fails, step b fails after step a)
* Test role-based access: Staff cannot access /admin routes
* Test with the PromoBullit API against a non-production store before enabling production stores
* Test mobile responsiveness across common screen sizes
* Deploy to Vercel
* Configure all environment variables in Vercel dashboard:
  * NEXT_PUBLIC_SUPABASE_URL
  * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  * SUPABASE_SERVICE_ROLE_KEY (for server-side admin operations)
  * CREDENTIALS_ENCRYPTION_KEY (32-byte hex string, generate fresh for production)
* Confirm Google Cloud OAuth redirect URI is updated to production Vercel domain
* Deliverable: App is live, functional, and secure on Vercel

ENVIRONMENT VARIABLES REFERENCE
  NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL (public, safe for client)
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY     — Supabase anon key (public, safe for client)
  SUPABASE_SERVICE_ROLE_KEY         — Supabase service role key (server-side only, never expose to client)
  CREDENTIALS_ENCRYPTION_KEY        — 64-char hex string (32 bytes) for AES-256-GCM encryption of PromoBullit credentials (server-side only, never expose to client)

SUCCESS CRITERIA
* Arcon staff can log in exclusively via Google Workspace — no other Google accounts are accepted
* On first login, users are prompted to enter and validate their PromoBullit credentials before accessing any task
* Users can update their PromoBullit credentials at any time via the Settings page
* PromoBullit credentials are stored encrypted in Supabase and never exposed to the client
* Store selector is always visible; switching stores is seamless at any time
* Staff can search for an order by order number, customer name, or email within the selected store
* Staff can select an order, choose a carrier, enter a tracking number, and submit
* The app successfully calls the PromoBullit API to create a shipment record on the order
* The app makes a SEPARATE subsequent PUT call to send the shipment notification email to the customer
* Both API call outcomes (success, partial, full failure) are communicated clearly to the user
* All API actions are logged in the Supabase audit_log table with status and context
* Admin users can manage the store list, manage user roles, and review the audit log
* The app is mobile-first and fully usable on phones and tablets
* The app is deployed to Vercel with all environment variables configured
* Dashboard task card grid clearly shows active features and "Coming Soon" placeholders for future modules
* The app is never tested against live production stores during development
