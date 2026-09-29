import '@testing-library/jest-dom/vitest'

/* jsdom non implementa matchMedia (usata per (display-mode: standalone)).
   Stub minimale con matching per media query e listener no-op. */
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
