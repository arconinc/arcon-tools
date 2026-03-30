#!/usr/bin/env node
/**
 * Interactive release script for The Arc.
 * Usage: npm run release
 *
 * What it does:
 *   1. Shows recent commits since the last git tag
 *   2. Asks for bump type (patch / minor / major / custom)
 *   3. Asks for a release title and summary
 *   4. Lets you categorize each commit as feature / improvement / bug fix / breaking / skip
 *   5. Writes the new entry to src/data/releases.json
 *   6. Updates package.json version
 *   7. Creates a local git tag v{newVersion}
 *   8. Prints next-step instructions
 */

import { execSync } from 'child_process'
import { createInterface } from 'readline'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PKG_PATH = resolve(ROOT, 'package.json')
const RELEASES_PATH = resolve(ROOT, 'src/data/releases.json')

// ─── helpers ──────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim()
  } catch {
    return ''
  }
}

function bumpVersion(current, type) {
  const base = current.split('-')[0]
  const [maj, min, pat] = base.split('.').map(Number)
  switch (type) {
    case 'major':    return `${maj + 1}.0.0`
    case 'minor':    return `${maj}.${min + 1}.0`
    case 'patch':    return `${maj}.${min}.${pat + 1}`
    case 'premajor': return `${maj + 1}.0.0-rc.0`
    case 'preminor': return `${maj}.${min + 1}.0-rc.0`
    case 'prepatch': return `${maj}.${min}.${pat + 1}-rc.0`
    default:         return type  // custom string
  }
}

function bold(str) { return `\x1b[1m${str}\x1b[0m` }
function dim(str)  { return `\x1b[2m${str}\x1b[0m` }
function green(str){ return `\x1b[32m${str}\x1b[0m` }
function cyan(str) { return `\x1b[36m${str}\x1b[0m` }
function red(str)  { return `\x1b[31m${str}\x1b[0m` }
function yellow(str){ return `\x1b[33m${str}\x1b[0m` }

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + bold('🚀  The Arc — Release Script') + '\n')

  // Read current version
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'))
  const currentVersion = pkg.version
  console.log(`Current version: ${bold('v' + currentVersion)}`)

  // Get last tag and commits since then
  const lastTag = exec('git describe --tags --abbrev=0 2>/dev/null')
  const logRange = lastTag ? `${lastTag}..HEAD` : 'HEAD'
  const rawCommits = exec(`git log ${logRange} --oneline`)
  const commits = rawCommits ? rawCommits.split('\n').filter(Boolean) : []

  if (commits.length === 0 && !lastTag) {
    console.log(yellow('\nNo commits found. Nothing to release.\n'))
    rl.close()
    return
  }

  if (lastTag) {
    console.log(`Last tag: ${bold(lastTag)}`)
  } else {
    console.log(dim('No previous tags found — showing all commits.'))
  }

  if (commits.length > 0) {
    console.log(`\n${bold('Commits since last release:')}\n`)
    commits.forEach((c) => console.log('  ' + dim(c)))
  } else {
    console.log(yellow('\nNo new commits since last tag.'))
    const proceed = await ask('Release anyway? (y/N) ')
    if (proceed.trim().toLowerCase() !== 'y') {
      rl.close()
      return
    }
  }

  // Bump type
  console.log(`\n${bold('Version bump type:')}`)
  console.log('  [1] patch   — bug fixes, small tweaks  (x.y.Z)')
  console.log('  [2] minor   — new features              (x.Y.0)')
  console.log('  [3] major   — breaking changes          (X.0.0)')
  console.log('  [4] custom  — enter a version manually')

  let bumpType = ''
  while (!bumpType) {
    const choice = (await ask('\nChoice [1]: ')).trim() || '1'
    if (choice === '1') bumpType = 'patch'
    else if (choice === '2') bumpType = 'minor'
    else if (choice === '3') bumpType = 'major'
    else if (choice === '4') {
      const custom = (await ask('Enter version (e.g. 1.2.0): ')).trim()
      if (/^\d+\.\d+\.\d+/.test(custom)) bumpType = custom
      else console.log(red('Invalid semver. Try again.'))
    } else {
      console.log(red('Enter 1, 2, 3, or 4.'))
    }
  }

  const newVersion = bumpType.match(/^\d/) ? bumpType : bumpVersion(currentVersion, bumpType)
  console.log(`\nNew version: ${bold(green('v' + newVersion))}`)

  // Release title
  const defaultTitle = `v${newVersion} Release`
  const titleInput = (await ask(`\nRelease title [${defaultTitle}]: `)).trim()
  const title = titleInput || defaultTitle

  // Release summary
  console.log(`\n${bold('Summary')} ${dim('(one or two sentences describing this release):')}`)
  const summary = (await ask('')).trim()
  if (!summary) {
    console.log(red('Summary is required.'))
    rl.close()
    return
  }

  // Categorize commits
  const changes = []

  if (commits.length > 0) {
    console.log(`\n${bold('Categorize each commit:')}`)
    console.log(dim('  [f] feature  [i] improvement  [b] bug fix  [B] breaking  [s] skip\n'))

    for (const commit of commits) {
      const hash = commit.slice(0, 7)
      const message = commit.slice(8)
      process.stdout.write(`  ${dim(hash)} ${message}\n`)

      let cat = null
      while (cat === null) {
        const key = (await ask(`  Category [f/i/b/B/s]: `)).trim().toLowerCase()
        if (key === 'f' || key === '') cat = 'feature'
        else if (key === 'i') cat = 'improvement'
        else if (key === 'b') cat = 'bug_fix'
        else if (key === 'B' || key === 'breaking') cat = 'breaking_change'
        else if (key === 's' || key === 'skip') cat = 'skip'
        else console.log(red('  Enter f, i, b, B, or s.'))
      }

      if (cat === 'skip') {
        console.log()
        continue
      }

      const defaultDesc = message.charAt(0).toUpperCase() + message.slice(1)
      const descInput = (await ask(`  Description [${defaultDesc}]: `)).trim()
      const description = descInput || defaultDesc
      changes.push({ category: cat, description })
      console.log()
    }
  }

  if (changes.length === 0) {
    const addManual = await ask('No changes categorized. Add a manual entry? (y/N) ')
    if (addManual.trim().toLowerCase() === 'y') {
      const cats = ['feature', 'improvement', 'bug_fix', 'breaking_change']
      console.log('  Categories: ' + cats.map((c, i) => `[${i + 1}] ${c}`).join('  '))
      const catIdx = parseInt((await ask('  Category [1]: ')).trim() || '1', 10) - 1
      const cat = cats[Math.max(0, Math.min(3, catIdx))]
      const description = (await ask('  Description: ')).trim()
      if (description) changes.push({ category: cat, description })
    }
  }

  // Confirm
  console.log('\n' + bold('─'.repeat(50)))
  console.log(`${bold('Release summary')}`)
  console.log(`  Version : ${bold('v' + newVersion)}`)
  console.log(`  Title   : ${title}`)
  console.log(`  Summary : ${summary}`)
  console.log(`  Changes : ${changes.length} items`)
  changes.forEach((c) => console.log(`    ${dim('[' + c.category + ']')} ${c.description}`))
  console.log(bold('─'.repeat(50)))

  const confirm = await ask('\nProceed? (Y/n) ')
  if (confirm.trim().toLowerCase() === 'n') {
    console.log(yellow('Aborted.'))
    rl.close()
    return
  }

  // Write releases.json
  const today = new Date().toISOString().slice(0, 10)
  const releases = JSON.parse(readFileSync(RELEASES_PATH, 'utf8'))
  const newEntry = { version: newVersion, date: today, title, summary, changes }
  releases.unshift(newEntry)
  writeFileSync(RELEASES_PATH, JSON.stringify(releases, null, 2) + '\n')
  console.log(green('\n✓ Updated src/data/releases.json'))

  // Write package.json
  pkg.version = newVersion
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n')
  console.log(green('✓ Updated package.json to v' + newVersion))

  // Create git tag
  try {
    exec(`git tag v${newVersion}`)
    console.log(green(`✓ Created git tag v${newVersion}`))
  } catch (e) {
    console.log(yellow(`⚠ Could not create git tag (may already exist): ${e.message}`))
  }

  // Instructions
  console.log('\n' + bold('Next steps:') + '\n')
  console.log(cyan(`  git add package.json src/data/releases.json`))
  console.log(cyan(`  git commit -m "Release v${newVersion}"`))
  console.log(cyan(`  git push && git push --tags`))
  console.log()

  rl.close()
}

main().catch((err) => {
  console.error(red('\nError: ' + err.message))
  process.exit(1)
})
