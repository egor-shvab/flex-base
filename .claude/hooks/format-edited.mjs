// PostToolUse hook: formats the file an Edit or Write just touched, so the next edit matches what
// is on disk. Silent and never blocking — a file Prettier does not know, or one outside the project,
// is left alone.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, relative, resolve, isAbsolute } from 'node:path'

let input = ''
for await (const chunk of process.stdin) input += chunk

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
let filePath
try {
  filePath = JSON.parse(input).tool_input?.file_path
} catch {
  // Not the payload a hook is handed: nothing to format
}
const prettier = join(projectDir, 'node_modules', 'prettier', 'bin', 'prettier.cjs')

if (filePath && existsSync(prettier)) {
  const insideProject = relative(projectDir, resolve(filePath))
  if (insideProject && !insideProject.startsWith('..') && !isAbsolute(insideProject)) {
    spawnSync(
      process.execPath,
      [prettier, '--write', '--ignore-unknown', '--log-level', 'silent', filePath],
      { cwd: projectDir, stdio: 'ignore' },
    )
  }
}
