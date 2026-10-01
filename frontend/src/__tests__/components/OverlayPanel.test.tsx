import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { OverlayPanel } from '../../components/OverlayPanel'

/* Il pannello va in portal su body: i query di testing-library li trovano lo
   stesso, perche' scorrono il document, ma i selettori CSS del modulo non
   arrivano — per il posizionamento si verifica sugli stili di classe. */
describe('OverlayPanel', () => {
  it('non renderizza nulla quando è chiuso', () => {
    render(<OverlayPanel open={false} title="Titolo" onClose={vi.fn()}>contenuto</OverlayPanel>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('mostra titolo, contenuto e footer quando è aperto', () => {
    render(
      <OverlayPanel open title="Modifica evento" onClose={vi.fn()} footer={<button type="button">Salva</button>}>
        <input aria-label="Nome" />
      </OverlayPanel>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Modifica evento' })).toBeTruthy()
    expect(screen.getByLabelText('Nome')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salva' })).toBeTruthy()
  })

  it('chiude con il tasto Escape', () => {
    const onClose = vi.fn()
    render(<OverlayPanel open title="Titolo" onClose={onClose}>contenuto</OverlayPanel>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chiude clicando sull\'overlay ma non cliccando dentro', () => {
    const onClose = vi.fn()
    render(
      <OverlayPanel open title="Titolo" onClose={onClose}>
        <button type="button">Dentro</button>
      </OverlayPanel>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dentro' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chiude con il bottone ×', () => {
    const onClose = vi.fn()
    render(<OverlayPanel open title="Titolo" onClose={onClose}>contenuto</OverlayPanel>)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})