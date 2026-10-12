import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { version } from '../package.json'

it('reports the package version through the CLI', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--version'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    encoding: 'utf8',
  })
  expect(output.trim().split('\n').at(-1)).toBe(version)
})
