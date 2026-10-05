import { request } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const frontendPort = Number(process.env.PLAYWRIGHT_FRONTEND_PORT ?? 3000)
const authStatePath = join(tmpdir(), `atlas-playwright-auth-state-${frontendPort}.json`)

export default async function globalSetup() {
  const context = await request.newContext({ baseURL: `http://127.0.0.1:${frontendPort}` })
  const registration = await context.post('/api/auth/register', {
    data: {
      roll_number: 'e2e0001',
      password: 'AtlasTest123!',
      name: 'Responsive Test Student',
      email: 'atlas-responsive-test@example.com',
      branch: 'Computer Science',
      year: 3,
    },
  })
  if (![200, 400].includes(registration.status())) {
    throw new Error(`Unable to create the isolated browser-test account (${registration.status()})`)
  }

  const login = await context.post('/api/auth/token', {
    form: { username: 'e2e0001', password: 'AtlasTest123!' },
  })
  if (!login.ok()) {
    throw new Error(`Unable to authenticate the isolated browser-test account (${login.status()})`)
  }
  await context.storageState({ path: authStatePath })
  await context.dispose()
}
