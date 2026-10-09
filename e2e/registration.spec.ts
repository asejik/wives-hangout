import { expect, test, type Page } from '@playwright/test'

const unique = () => Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

async function fillRequired(page: Page, phone: string, email: string) {
  await page.getByLabel('Full name', { exact: true }).fill('E2E Tester')
  await page.getByLabel('How many years married?').fill('6')
  await page.getByLabel('Phone number (WhatsApp)').fill(phone)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByText('Citizens of Light Church', { exact: true }).click()
  await page.getByLabel('How did you hear about the Wives Hangout?').selectOption('Flyer')
  await page.getByText('No', { exact: true }).click()
  await page.getByRole('checkbox').check()
}

// The server treats sub-3-second submits as bots; real people are never that fast.
const submitLikeAPerson = async (page: Page) => {
  await page.waitForTimeout(3_100)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?src=e2e')
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible()
})

test('happy path: register, see the summary, then back to an empty form', async ({ page }) => {
  await expect(page.getByText('4:00 PM')).toBeVisible()
  expect(await page.content()).not.toContain('Freedom')
  const id = unique()
  await fillRequired(page, `0905${id}`, `e2e-${id}@example.invalid`)
  await submitLikeAPerson(page)
  await expect(page.getByRole('heading', { name: "You're registered!" })).toBeVisible()
  await expect(page.getByText('Thank you, E2E.')).toBeVisible()
  await expect(page.getByText(`e2e-${id}@example.invalid`).first()).toBeVisible()
  await expect(page.getByText('6 years')).toBeVisible()
  await expect(page.getByText('check your inbox (and your spam folder)', { exact: false })).toBeVisible()
  // The venue appears only now, after registering (it comes from the server's success reply).
  await expect(page.getByText('Freedom Dome, Ilesanmi Bus Stop, Tanke, Ilorin')).toBeVisible()

  await page.getByRole('button', { name: '← Back to home' }).click()
  await expect(page.getByRole('heading', { name: 'Register', exact: true })).toBeVisible()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('')
})

test('shows every error at once, including the "Other" fields', async ({ page }) => {
  await page.locator('label', { hasText: /^Other$/ }).click() // church
  await page.getByLabel('How did you hear about the Wives Hangout?').selectOption('Other')
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  for (const message of [
    'Enter your full name',
    "Enter how many years you've been married",
    'Enter an 11-digit number, e.g. 08012345678',
    'Enter the name of your church',
    'Tell us how you heard',
    'Choose No or Yes',
    'You need to agree to register',
  ]) {
    await expect(page.getByText(message)).toBeVisible()
  }
  await expect(page.getByLabel('Full name', { exact: true })).toBeFocused()
})

test('the child question is asked word for word, and Yes is saved and summarised', async ({ page }) => {
  await expect(
    page.getByText('This event is designed for wives to attend without children. Will you need to bring a child due to childcare limitations?'),
  ).toBeVisible()
  const id = unique()
  await fillRequired(page, `0907${id}`, `e2e-c-${id}@example.invalid`)
  await page.getByText('Yes', { exact: true }).click()
  await submitLikeAPerson(page)
  await expect(page.getByRole('heading', { name: "You're registered!" })).toBeVisible()
  const childRow = page.locator('dl > div', { hasText: 'Bringing a child' })
  await expect(childRow.locator('dd')).toHaveText('Yes')
})

test('duplicate phone shows "already registered" and none of the stored details', async ({ page }) => {
  const id = unique()
  await fillRequired(page, `0906${id}`, `e2e-a-${id}@example.invalid`)
  await submitLikeAPerson(page)
  await expect(page.getByRole('heading', { name: "You're registered!" })).toBeVisible()

  await page.goto('/?src=e2e')
  await fillRequired(page, `+234 906 ${id.slice(0, 3)} ${id.slice(3)}`, `e2e-b-${id}@example.invalid`)
  await submitLikeAPerson(page)
  await expect(page.getByRole('heading', { name: "You're already registered" })).toBeVisible()
  expect(await page.content()).not.toContain(`e2e-a-${id}`)
})

test('answers survive a page refresh', async ({ page }) => {
  await page.getByLabel('Full name', { exact: true }).fill('Refresh Survivor')
  await page.getByLabel('How many years married?').fill('12')
  await page.locator('label', { hasText: /^Other$/ }).click()
  await page.getByLabel('Name of your church').fill('Living Faith')
  await page.reload()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Refresh Survivor')
  await expect(page.getByLabel('How many years married?')).toHaveValue('12')
  await expect(page.getByLabel('Name of your church')).toHaveValue('Living Faith')
})

test('closed and "opens soon" replace the form', async ({ page }) => {
  await page.route('**/api/status', (r) => r.fulfill({ json: { state: 'closed', opensAt: null } }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Registration is closed' })).toBeVisible()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveCount(0)

  await page.route('**/api/status', (r) => r.fulfill({ json: { state: 'not_open', opensAt: '2026-10-13T08:00:00+01:00' } }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Registration opens soon' })).toBeVisible()
  await expect(page.getByText('Tuesday, 13 October')).toBeVisible()
})

test('offline: a banner, and the answers stay', async ({ page, context }) => {
  const id = unique()
  await fillRequired(page, `0908${id}`, `e2e-o-${id}@example.invalid`)
  await page.waitForTimeout(3_100)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await expect(page.getByText('You seem to be offline.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('E2E Tester')
  await context.setOffline(false)
})

test('privacy notice is linked from the consent and loads', async ({ page }) => {
  const [privacy] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Read the privacy notice' }).click()])
  await expect(privacy.getByRole('heading', { name: 'Privacy notice' })).toBeVisible()
  await expect(privacy.getByText('24 January 2027')).toBeVisible()
  await expect(privacy.getByText('clcchurchmedia@gmail.com').first()).toBeVisible()
})
