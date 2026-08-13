import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const RULES_PATH = fileURLToPath(new URL('../../../firestore.rules', import.meta.url))

export function loadRules(): string {
  return readFileSync(RULES_PATH, 'utf8')
}

export function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-snapspare',
    firestore: {
      rules: loadRules(),
      host: '127.0.0.1',
      port: 8080,
    },
  })
}
