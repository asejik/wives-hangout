import { describe, expect, it } from 'vitest'
import { yearsMarriedLabel } from './event.js'
import { churchLabel, fieldErrors, heardLabel, registrationSchema, toPayload } from './registration.js'

const valid = {
  full_name: '  Funmilayo Adeyemi ', years_married: ' 7 ', occupation: ' Nurse ', phone: '+234 801 234 5678', email: 'Funmi@Example.com ',
  church: 'Citizens of Light Church', church_other: '', heard_via: 'WhatsApp', heard_other: '',
  bringing_child: 'No', consent: true, source: 'qr',
}

const errorsFor = (input: object) => {
  const r = registrationSchema.safeParse(input)
  return r.success ? {} : fieldErrors(r.error)
}

describe('registrationSchema', () => {
  it('accepts a valid registration and normalises it for storage', () => {
    expect(toPayload(registrationSchema.parse(valid))).toEqual({
      full_name: 'Funmilayo Adeyemi', years_married: 7, occupation: 'Nurse', phone: '08012345678', email: 'funmi@example.com',
      church: 'Citizens of Light Church', church_other: '', heard_via: 'WhatsApp', heard_other: '',
      bringing_child: false, source: 'qr',
    })
  })

  it('gives plain messages for each bad field, all at once', () => {
    expect(errorsFor({ ...valid, full_name: 'F', occupation: ' ', phone: '0801', email: 'funmi@', church: '', heard_via: '', bringing_child: '', consent: false })).toEqual({
      full_name: 'Enter your full name',
      occupation: 'Enter your occupation',
      phone: 'Enter an 11-digit number, e.g. 08012345678',
      email: 'Enter a valid email, e.g. name@gmail.com',
      church: 'Choose your church',
      heard_via: 'Choose one',
      bringing_child: 'Choose No or Yes',
      consent: 'You need to agree to register',
    })
  })

  it.each([
    ['', "Enter how many years you've been married"],
    ['abc', 'Enter a number, e.g. 5'],
    ['2.5', 'Enter a number, e.g. 5'],
    ['-1', 'Enter a number, e.g. 5'],
    ['81', 'Enter a number from 0 to 80'],
    ['150', 'Enter a number, e.g. 5'],
  ])('rejects years married %j', (years, message) => {
    expect(errorsFor({ ...valid, years_married: years })).toEqual({ years_married: message })
  })

  it('accepts 0 (less than a year) up to 80 years married', () => {
    expect(toPayload(registrationSchema.parse({ ...valid, years_married: '0' })).years_married).toBe(0)
    expect(toPayload(registrationSchema.parse({ ...valid, years_married: '80' })).years_married).toBe(80)
  })

  it('requires the church name only when Other is chosen', () => {
    expect(errorsFor({ ...valid, church: 'Other' })).toEqual({ church_other: 'Enter the name of your church' })
    const r = toPayload(registrationSchema.parse({ ...valid, church: 'Other', church_other: 'Living Faith Church' }))
    expect(r).toMatchObject({ church: 'Other', church_other: 'Living Faith Church' })
    expect(toPayload(registrationSchema.parse({ ...valid, church_other: 'Leftover' })).church_other).toBe('')
  })

  it('requires the "how did you hear" text only when Other is chosen', () => {
    expect(errorsFor({ ...valid, heard_via: 'Other' })).toEqual({ heard_other: 'Tell us how you heard' })
    expect(toPayload(registrationSchema.parse({ ...valid, heard_via: 'Other', heard_other: 'Radio' })).heard_other).toBe('Radio')
    expect(toPayload(registrationSchema.parse({ ...valid, heard_other: 'Leftover' })).heard_other).toBe('')
  })

  it('rejects options that are not offered', () => {
    expect(errorsFor({ ...valid, heard_via: 'TikTok', church: 'Somewhere' })).toEqual({ heard_via: 'Choose one', church: 'Choose your church' })
  })

  it('stores the child answer as a boolean', () => {
    expect(toPayload(registrationSchema.parse({ ...valid, bringing_child: 'Yes' })).bringing_child).toBe(true)
  })

  it('reports Other-field errors together with other field errors', () => {
    const errors = errorsFor({ ...valid, full_name: '', church: 'Other', heard_via: 'Other' })
    expect(Object.keys(errors).sort()).toEqual(['church_other', 'full_name', 'heard_other'])
  })

  it('caps long input', () => {
    expect(errorsFor({ ...valid, full_name: 'x'.repeat(81) })).toEqual({ full_name: 'Keep it under 80 characters' })
    expect(errorsFor({ ...valid, occupation: 'x'.repeat(81) })).toEqual({ occupation: 'Keep it under 80 characters' })
  })
})

describe('labels', () => {
  it('reads stored answers the way a person would', () => {
    expect(yearsMarriedLabel(0)).toBe('Less than a year')
    expect(yearsMarriedLabel(1)).toBe('1 year')
    expect(yearsMarriedLabel(12)).toBe('12 years')
    expect(churchLabel({ church: 'Other', church_other: 'Living Faith' })).toBe('Living Faith')
    expect(churchLabel({ church: 'Citizens of Light Church', church_other: '' })).toBe('Citizens of Light Church')
    expect(heardLabel({ heard_via: 'Other', heard_other: 'Radio' })).toBe('Other: Radio')
  })
})
