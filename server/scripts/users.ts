import { createUser, normalizeEmail, setUserPassword, validateEmail } from '../auth'
import { promptNewPassword } from './prompt-password'

const USAGE = 'Usage: yarn user:create <email> | yarn user:password <email>'

async function main(): Promise<void> {
  const [command, rawEmail] = process.argv.slice(2)
  if (!rawEmail?.trim()) {
    throw new Error(USAGE)
  }
  const emailError = validateEmail(rawEmail)
  if (emailError) {
    throw new Error(emailError)
  }
  const email = normalizeEmail(rawEmail)

  switch (command) {
    case 'create': {
      const password = await promptNewPassword()
      const user = await createUser(email, password)
      console.log(`Created user ${user.email} (${user.id})`)
      return
    }
    case 'password': {
      const password = await promptNewPassword()
      if (!(await setUserPassword(email, password))) {
        throw new Error(`No user found for ${email}`)
      }
      console.log(`Password updated for ${email}; existing sessions were revoked`)
      return
    }
    default:
      throw new Error(USAGE)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
