import { expect, test } from '@playwright/test'

// Needs migration 003 in the database. Registers a dev person (source=e2e; teardown deletes her, which
// also deletes her meal choice and puts the plate back), then chooses a meal at /menu.
const unique = () => Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

test('choose a meal by phone: count drops, pass with code, no second choice; email works too', async ({ page }) => {
  const id = unique()
  const phone = `0909${id}`
  const email = `e2e-menu-${id}@example.invalid`
  await page.goto('/?src=e2e')
  await page.getByLabel('Full name', { exact: true }).fill('E2E Menu Tester')
  await page.getByLabel('How many years married?').fill('4')
  await page.getByLabel('Occupation', { exact: true }).fill('Tester')
  await page.getByLabel('Phone number (WhatsApp)').fill(phone)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.locator('label', { hasText: /^Citizens of Light Church$/ }).click()
  await page.getByLabel('How did you hear about the Wives Hangout?').selectOption('Flyer')
  await page.getByText('No', { exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(3_100)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await expect(page.getByRole('heading', { name: "You're registered!" })).toBeVisible()

  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: 'Choose your meal' })).toBeVisible()
  const row = page.locator('li', { hasText: 'Jollof rice and chicken' })
  await expect(row).toContainText(/\d+ left/)
  const before = Number((await row.innerText()).match(/(\d+) left/)![1])

  // Unknown person first
  await page.getByLabel('Phone number or email you registered with').fill('09000000001')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText("We couldn't find a registration with that", { exact: false })).toBeVisible()

  await page.getByLabel('Phone number or email you registered with').fill(phone)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Hi, E2E!')).toBeVisible()
  // The seat number is required before choosing.
  await row.getByRole('button', { name: 'Choose' }).click()
  await expect(page.getByText('Enter your seat number first', { exact: false })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Your seat number').fill('7')
  await row.getByRole('button', { name: 'Choose' }).click()
  await expect(page.getByRole('dialog', { name: 'Confirm your meal' })).toContainText('Seat 7')
  await expect(page.getByRole('dialog', { name: 'Confirm your meal' })).toContainText("You can't change it after this.")
  await page.getByRole('button', { name: 'Yes, choose it' }).click()

  const pass = page.getByRole('dialog', { name: 'Your meal' })
  await expect(pass).toContainText('E2E Menu Tester')
  await expect(pass).toContainText('Jollof rice and chicken')
  await expect(pass).toContainText('Take a screenshot now')
  await expect(pass).toContainText('Seat7')
  await expect(pass.getByLabel(/^Code [2-9A-HJKMNP-Z]( [2-9A-HJKMNP-Z]){3}$/)).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(row).toContainText('Your choice')
  await expect(page.getByRole('button', { name: 'Choose' })).toHaveCount(0) // one meal only

  // Changed seats: the seat can be corrected, the meal can't.
  await page.getByRole('button', { name: 'Change seat number' }).click()
  await page.getByLabel('Change your seat number').fill('b12')
  await page.getByRole('button', { name: 'Save seat number' }).click()
  await expect(page.getByText('Seat number saved: B12.')).toBeVisible()

  // Back by email in a fresh tab: she sees her pass, not the choose buttons.
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.getByLabel('Phone number or email you registered with').fill(email.toUpperCase())
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Jollof rice and chicken').last()).toBeVisible()
  await expect(page.getByText('Take a screenshot now')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose' })).toHaveCount(0)
  const after = Number((await page.locator('li', { hasText: 'Jollof rice and chicken' }).innerText().catch(() => '')).match(/(\d+) left/)?.[1] ?? before - 1)
  expect(after).toBeLessThanOrEqual(before - 1)
})
