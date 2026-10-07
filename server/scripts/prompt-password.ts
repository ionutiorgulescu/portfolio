import { createInterface } from 'node:readline'
import { validatePassword } from '../auth'

function promptHidden(label: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    const output = rl as unknown as { _writeToOutput: (value: string) => void }
    output._writeToOutput = (value) => {
      if (!muted) process.stdout.write(value)
    }
    rl.question(label, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
    muted = true
  })
}

export async function promptNewPassword(): Promise<string> {
  const password = await promptHidden('Password: ')
  const validationError = validatePassword(password)
  if (validationError) {
    throw new Error(validationError)
  }

  const confirmation = await promptHidden('Confirm password: ')
  if (password !== confirmation) {
    throw new Error('Passwords do not match')
  }

  return password
}
