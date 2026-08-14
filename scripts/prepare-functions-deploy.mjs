// Firebase's Cloud Build step runs a plain `npm install` inside the zipped
// functions/ directory alone — it has no pnpm workspace, so functions/package.json's
// "@snapspare/shared": "workspace:*" is unresolvable there (EUNSUPPORTEDPROTOCOL).
// This packs @snapspare/shared into a tarball next to functions/package.json and
// points the dependency at it for the duration of the deploy; restore-functions-deploy.mjs
// (firebase.json's postdeploy hook) puts "workspace:*" back afterwards so local
// pnpm installs keep resolving it as a live workspace link.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const functionsDir = path.join(repoRoot, 'functions')
const sharedDir = path.join(repoRoot, 'packages', 'shared')
const packageJsonPath = path.join(functionsDir, 'package.json')
const backupPath = path.join(functionsDir, 'package.json.bak')

// A deploy that fails after this script runs but before firebase's postdeploy
// hook (restore-functions-deploy.mjs) — e.g. a function create/update error —
// leaves package.json swapped and a stale .bak behind. Self-heal instead of
// requiring a manual restore before every retry.
if (existsSync(backupPath)) {
  console.warn(`${backupPath} exists from an interrupted previous deploy — restoring it before continuing.`)
  renameSync(backupPath, packageJsonPath)
  for (const name of readdirSync(functionsDir)) {
    if (name.endsWith('.tgz')) unlinkSync(path.join(functionsDir, name))
  }
}

const packOutput = execFileSync('pnpm', ['pack', '--pack-destination', functionsDir], {
  cwd: sharedDir,
  encoding: 'utf8',
  shell: true,
})
// pnpm pack's last stdout line names the tarball — as a bare filename on some
// versions, an absolute path on others. Only the basename is ever meaningful
// here (the file always lands directly in functionsDir via --pack-destination),
// and only the basename survives being zipped up for Cloud Build.
const lastLine = packOutput.trim().split('\n').pop()?.trim()
const tarballName = lastLine ? path.basename(lastLine) : undefined
if (!tarballName || !tarballName.endsWith('.tgz') || !existsSync(path.join(functionsDir, tarballName))) {
  throw new Error(`Could not determine packed tarball name from pnpm pack output:\n${packOutput}`)
}

const packageJsonRaw = readFileSync(packageJsonPath, 'utf8')
renameSync(packageJsonPath, backupPath)
const packageJson = JSON.parse(packageJsonRaw)
packageJson.dependencies['@snapspare/shared'] = `file:./${tarballName}`
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

console.log(`Packed @snapspare/shared -> functions/${tarballName}, pointed functions/package.json at it.`)
