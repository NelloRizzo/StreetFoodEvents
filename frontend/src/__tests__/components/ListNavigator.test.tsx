import { describe, expect, it, vi } from 'vitest'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DateIndex, LetterIndex, Pagination } from '../../components/ListNavigator'

const noop = () => {}

describe('Pagination', () => {
  it('senza elementi non mostra nulla', () => {
    render(<Pagination page={1} totalPages={1} total={0} noun={{ one: 'prodotto', many: 'prodotti' }} onChange={noop} />)
    expect(screen.queryByRole('navigation', { name: 'Paginazione' })).toBeNull()
  })

  /* Una sola pagina: le frecce sono rumore, il conteggio no — è l'unico
     feedback che resta dopo un filtro ristretto. */
  it('con una sola pagina mostra solo il conteggio, al singolare se serve', () => {
    render(<Pagination page={1} totalPages={1} total={1} noun={{ one: 'evento', many: 'eventi' }} onChange={noop} />)
    expect(screen.getByText('1 evento')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Precedente/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Successiva/ })).toBeNull()
  })

  it('con piu\' pagine conta e limita le frecce agli estremi', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} total={45} noun={{ one: 'stand', many: 'stand' }} onChange={noop} />)
    expect(screen.getByText('Pagina 1 di 3 · 45 stand')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Precedente/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Successiva/ })).toBeEnabled()

    rerender(<Pagination page={3} totalPages={3} total={45} noun={{ one: 'stand', many: 'stand' }} onChange={noop} />)
    expect(screen.getByRole('button', { name: /Precedente/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Successiva/ })).toBeDisabled()
  })

  it('chiede la pagina adiacente', async () => {
    const onChange = vi.fn()
    render(<Pagination page={2} totalPages={3} total={45} noun={{ one: 'stand', many: 'stand' }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Precedente/ }))
    expect(onChange).toHaveBeenCalledWith(1)
    await userEvent.click(screen.getByRole('button', { name: /Successiva/ }))
    expect(onChange).toHaveBeenCalledWith(3)
  })
})

describe('LetterIndex', () => {
  it('con una sola iniziale non compare: non c\'e\' niente da scegliere', () => {
    render(<LetterIndex letters={['P']} active={null} onChange={noop} />)
    expect(screen.queryByRole('group', { name: 'Iniziale' })).toBeNull()
  })

  it('filtra e si spegne cliccando di nuovo la lettera attiva', async () => {
    const onChange = vi.fn()
    render(<LetterIndex letters={['#', 'A', 'B']} active="B" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith(null)

    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onChange).toHaveBeenCalledWith('A')

    await userEvent.click(screen.getByRole('button', { name: 'Tutte' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('DateIndex', () => {
  it('mostra i mesi solo con un anno attivo, e solo quelli presenti', () => {
    const { rerender } = render(
      <DateIndex years={[2027, 2026]} months={[]} activeYear={null} activeMonth={null} onYear={noop} onMonth={noop} />
    )
    expect(screen.getByRole('group', { name: 'Anno' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mese' })).toBeNull()

    rerender(<DateIndex years={[2027, 2026]} months={[0, 5]} activeYear={2027} activeMonth={null} onYear={noop} onMonth={noop} />)
    const months = screen.getByRole('group', { name: 'Mese' })
    expect(within(months).getByRole('button', { name: 'gen' })).toBeInTheDocument()
    expect(within(months).getByRole('button', { name: 'giu' })).toBeInTheDocument()
    /* Nessun mese vuoto: un chip che non porta a nulla fa perdere fiducia. */
    expect(within(months).queryByRole('button', { name: 'lug' })).toBeNull()
  })

  it('propaga anno e mese, e li azzera cliccando la voce attiva', async () => {
    const onYear = vi.fn()
    const onMonth = vi.fn()
    render(<DateIndex years={[2027, 2026]} months={[5]} activeYear={2027} activeMonth={5} onYear={onYear} onMonth={onMonth} />)

    const years = screen.getByRole('group', { name: 'Anno' })
    await userEvent.click(within(years).getByRole('button', { name: '2026' }))
    expect(onYear).toHaveBeenCalledWith(2026)

    /* Cliccare l'anno già attivo lo toglie: è la via per tornare a tutti gli eventi. */
    await userEvent.click(within(years).getByRole('button', { name: '2027' }))
    expect(onYear).toHaveBeenCalledWith(null)

    const months = screen.getByRole('group', { name: 'Mese' })
    await userEvent.click(within(months).getByRole('button', { name: 'giu' }))
    expect(onMonth).toHaveBeenCalledWith(null)

    await userEvent.click(within(months).getByRole('button', { name: 'Tutti' }))
    expect(onMonth).toHaveBeenCalledWith(null)
  })

  it('senza anni in elenco non compare', () => {
    render(<DateIndex years={[]} months={[]} activeYear={null} activeMonth={null} onYear={noop} onMonth={noop} />)
    expect(screen.queryByRole('group', { name: 'Anno' })).toBeNull()
  })
})
