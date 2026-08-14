// Undoes prepare-functions-deploy.mjs: restores functions/package.json's
// "@snapspare/shared": "workspace:*" and removes the packed tarball, so a
// local `pnpm install` keeps resolving it as a live workspace link.
import { existsSync, renameSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const functionsDir = path.join(repoRoot, 'functions')
const packageJsonPath = path.join(functionsDir, 'package.json')
const backupPath = path.join(functionsDir, 'package.json.bak')

if (existsSync(backupPath)) {
  renameSync(backupPath, packageJsonPath)
} else {
  console.warn(`${backupPath} not found — nothing to restore.`)
}

for (const name of readdirSync(functionsDir)) {
  if (name.endsWith('.tgz')) {
    unlinkSync(path.join(functionsDir, name))
    console.log(`Removed functions/${name}`)
  }
}

console.log('Restored functions/package.json to workspace:*.')
