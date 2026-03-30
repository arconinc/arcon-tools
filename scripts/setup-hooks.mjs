#!/usr/bin/env node
/**
 * Installs the pre-push git hook that enforces running `npm run release`
 * before pushing to remote.
 *
 * Run once after cloning:
 *   npm run setup-hooks
 */

import { writeFileSync, chmodSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const HOOKS_DIR = resolve(ROOT, '.git/hooks')
const HOOK_PATH = resolve(HOOKS_DIR, 'pre-push')

const HOOK_SCRIPT = `#!/bin/sh
# Pre-push hook: enforce that a release tag exists for the current version.
# Install via: npm run setup-hooks

VERSION=$(node -p "require('./package.json').version" 2>/dev/null)
if [ -z "$VERSION" ]; then
  echo ""
  echo "  pre-push: could not read version from package.json"
  echo ""
  exit 1
fi

TAG="v$VERSION"

if ! git tag --list | grep -q "^\${TAG}$"; then
  echo ""
  echo "  ✗ No git tag found for the current version ($TAG)."
  echo ""
  echo "  Run 'npm run release' to create a release entry and tag"
  echo "  before pushing. This ensures every push is versioned and"
  echo "  documented in the release notes."
  echo ""
  exit 1
fi

exit 0
`

if (!existsSync(HOOKS_DIR)) {
  console.error('Error: .git/hooks directory not found. Are you in the project root?')
  process.exit(1)
}

writeFileSync(HOOK_PATH, HOOK_SCRIPT)
chmodSync(HOOK_PATH, 0o755)

console.log('✓ Installed pre-push hook at .git/hooks/pre-push')
console.log('  Pushes will be blocked until you run: npm run release')
