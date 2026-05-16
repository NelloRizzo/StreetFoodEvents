import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { acceptAll, rejectAll, hasConsent } from '../lib/consent'
import { initGTM } from '../lib/gtm'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(!hasConsent())

  const handleAccept = useCallback(() => {
    acceptAll()
    initGTM()
    setVisible(false)
  }, [])

  const handleReject = useCallback(() => {
    rejectAll()
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div className="cookie-consent-banner">
      <div className="cookie-consent-banner__content">
        <p>
          Questo sito utilizza cookie tecnici necessari al funzionamento e, con il tuo consenso, cookie analytics e pubblicitari.
          {' '}<Link to="/privacy" onClick={() => setVisible(false)}>Maggiori informazioni</Link>.
        </p>
        <div className="cookie-consent-banner__actions">
          <button
            className="cookie-consent-banner__btn cookie-consent-banner__btn--secondary"
            onClick={handleReject}
          >
            Rifiuta tutti
          </button>
          <button
            className="cookie-consent-banner__btn cookie-consent-banner__btn--primary"
            onClick={handleAccept}
          >
            Accetta tutti
          </button>
        </div>
      </div>
    </div>
  )
}
