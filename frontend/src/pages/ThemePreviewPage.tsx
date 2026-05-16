import { useState } from 'react'
import styles from './ThemePreviewPage.module.scss'

type ThemeId = 'spring' | 'summer' | 'autumn' | 'winter' | 'christmas' | 'easter'

const themes: { id: ThemeId; label: string; icon: string }[] = [
  { id: 'spring', label: 'Primavera', icon: '🌸' },
  { id: 'summer', label: 'Estate', icon: '☀️' },
  { id: 'autumn', label: 'Autunno', icon: '🍂' },
  { id: 'winter', label: 'Inverno', icon: '❄️' },
  { id: 'christmas', label: 'Natale', icon: '🎄' },
  { id: 'easter', label: 'Pasqua', icon: '🐣' },
]

export function ThemePreviewPage() {
  const [active, setActive] = useState<ThemeId | null>(null)

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <span className="eyebrow">Anteprima</span>
          <h1 className={styles.title}>Temi stagionali</h1>
          <p className={styles.copy}>
            Ogni card mostra il tema applicato. Clicca per attivarlo globalmente.
          </p>
        </div>

        <div className={styles.grid}>
          {themes.map((t) => (
            <div
              key={t.id}
              className={`theme-${t.id} ${styles.themeCard} ${active === t.id ? styles.active : ''}`}
              onClick={() => setActive(t.id)}
            >
              <div className={styles.cardInner}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>{t.icon}</span>
                  <span className={styles.cardLabel}>{t.label}</span>
                  {active === t.id && <span className={styles.cardBadge}>Attivo</span>}
                </div>

                {/* Sample UI */}
                <div className={styles.sampleSection}>
                  <span className={styles.sampleEyebrow}>Esempio contenuti</span>
                  <h3 className={styles.sampleTitle}>
                    Questo è un titolo
                  </h3>
                  <p className={styles.sampleCopy}>
                    Colore testo normale e soft. Una card dimostrativa per valutare
                    il tema con contenuti reali.
                  </p>
                </div>

                <div className={styles.sampleActions}>
                  <span className={styles.sampleBtn}>Bottone primario</span>
                  <span className={styles.sampleBtnSecondary}>Secondario</span>
                </div>

                <div className={styles.sampleCard}>
                  <strong className={styles.sampleCardLabel}>Saldo wallet</strong>
                  <span className={styles.sampleCardValue}>42 <span className={styles.sampleCurrency}>Scrip</span></span>
                </div>

                <div className={styles.swatchGrid}>
                  <span className={styles.swatch} style={{ background: 'var(--color-brand)' }} title="Brand" />
                  <span className={styles.swatch} style={{ background: 'var(--color-brand-deep)' }} title="Brand deep" />
                  <span className={styles.swatch} style={{ background: 'var(--color-brand-soft)' }} title="Brand soft" />
                  <span className={styles.swatch} style={{ background: 'var(--color-highlight)' }} title="Highlight" />
                  <span className={styles.swatch} style={{ background: 'var(--color-ink-strong)' }} title="Text strong" />
                  <span className={styles.swatch} style={{ background: 'var(--color-ink)' }} title="Text" />
                  <span className={styles.swatch} style={{ background: 'var(--color-ink-soft)' }} title="Text soft" />
                  <span className={styles.swatch} style={{ background: 'var(--color-surface)' }} title="Surface" />
                  <span className={styles.swatch} style={{ background: 'var(--color-line)' }} title="Line" />
                  <span className={styles.swatch} style={{ background: 'var(--color-line-strong)' }} title="Line strong" />
                  <span className={styles.swatch} style={{ background: 'var(--color-olive)' }} title="Olive" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
