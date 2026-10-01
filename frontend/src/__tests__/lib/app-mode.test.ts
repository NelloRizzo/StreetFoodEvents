import { describe, expect, it } from 'vitest'

import { isCustomersPwa } from '../../lib/app-mode'

describe('isCustomersPwa', () => {
  const setPath = (pathname: string) => {
    window.history.replaceState({}, '', pathname)
  }

  it('detects the customers PWA mount point', () => {
    setPath('/customers/')
    expect(isCustomersPwa()).toBe(true)

    setPath('/customers/profilo')
    expect(isCustomersPwa()).toBe(true)

    setPath('/customers/events/evt1')
    expect(isCustomersPwa()).toBe(true)
  })

  it('detects the customers home without trailing slash', () => {
    /* customersHome() restituisce '/customers': senza questo caso la PWA su
       quell'URL si credeva il sito operatore (tab profilo = menu web app,
       dopo il login si atterrava su /dashboard -> dashboard admin). */
    setPath('/customers')
    expect(isCustomersPwa()).toBe(true)
  })

  it('returns false on the operator app', () => {
    setPath('/')
    expect(isCustomersPwa()).toBe(false)

    setPath('/admin/dashboard')
    expect(isCustomersPwa()).toBe(false)

    setPath('/profilo')
    expect(isCustomersPwa()).toBe(false)
  })

  it('does not match a path that merely starts with the same letters', () => {
    setPath('/customersomething')
    expect(isCustomersPwa()).toBe(false)
  })
})
