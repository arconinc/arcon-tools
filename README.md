# The Arc — Arcon's Internal Tools Platform

A Next.js + React web app for internal operations across Sales, Marketing, Accounting, Warehouse, IT, and HR departments. Features include CRM, e-commerce store management, employee directory, document library, task management, and more.

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account with OAuth configured

### Installation

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev
```

### Build & Deployment

```bash
# Production build
npm run build

# Run production build locally
npm start

# Lint code
npm run lint
```

## Release Process

Release notes are documented in [`src/data/releases.json`](src/data/releases.json) and displayed at `/releases`.

### Creating a Release

Run the interactive release script:

```bash
npm run release
```

The script will:
1. Show recent commits since the last git tag
2. Prompt for version bump type (patch / minor / major / custom)
3. Ask for a release title and summary
4. Let you categorize each commit as feature / improvement / bug fix / breaking change / skip
5. Update `src/data/releases.json`, `package.json`, and create a git tag
6. Print next-step instructions for commit and push

**Example workflow:**

```bash
npm run release
# Choose version bump
# Enter release title (e.g., "Notifications System")
# Enter summary (1-2 sentences)
# Categorize each commit interactively
# Confirm changes
# Follow printed instructions to commit and push
```

After the script completes, commit and push as instructed:

```bash
git add package.json src/data/releases.json
git commit -m "Release v0.4.0"
git push && git push --tags
```

## Documentation

See [`CLAUDE.md`](CLAUDE.md) for:
- Stack and project structure
- Supabase patterns and security
- API endpoints and database tables
- Feature documentation (Notifications, Employee Directory, CRM, Documents, etc.)
- Styling conventions

## Key Features

- **CRM & Marketing** — Customers, contacts, opportunities, tasks, tags, artwork
- **E-Commerce** — Store management with Gantt timelines and order tracking
- **Employee Directory** — Searchable profiles with org chart, skills, and interests
- **Document Library** — Hierarchical Google Drive integration
- **News & Announcements** — Rich-text editor with Tiptap
- **Task Management** — Cross-department task boards with priority and comments
- **Admin Panel** — User management, impersonation, content editors, audit logs
- **Notifications** — In-app + email with per-user preferences
- **Gmail Add-On** — Create tasks directly from Gmail

## Support

For issues, feature requests, or questions, check the project documentation or reach out to the core team.
