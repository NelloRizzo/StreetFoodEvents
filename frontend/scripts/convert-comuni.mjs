import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const csvPath = resolve(__dirname, '..', 'src', 'data', 'comuni.csv')
const jsonPath = resolve(__dirname, '..', 'src', 'data', 'comuni.json')

if (!existsSync(csvPath)) {
  console.error('File non trovato: ' + csvPath)
  console.error('Posiziona il CSV ISTAT dei comuni italiani in frontend/src/data/comuni.csv')
  process.exit(1)
}

const raw = readFileSync(csvPath)
const decoder = new TextDecoder('iso-8859-1')
const text = decoder.decode(raw)

const lines = text.split(/\r?\n/).filter(Boolean)

// Skip 3 header lines
const dataLines = lines.slice(3)

const comuniPerRegione = {}
const provinceNames = {}

for (const line of dataLines) {
  const parts = line.split(';')
  // 6  = Denominazione in italiano (comune)
  // 10 = Denominazione Regione
  // 11 = Denominazione dell'Unità territoriale sovracomunale (provincia) — full name
  // 14 = Sigla automobilistica
  const comune = (parts[6] || '').trim()
  const regione = (parts[10] || '').trim()
  const provinciaSigla = (parts[14] || '').trim()
  const provinciaNome = (parts[11] || '').trim()

  if (!comune || !regione || !provinciaSigla || !provinciaNome) continue

  if (!comuniPerRegione[regione]) {
    comuniPerRegione[regione] = {}
  }
  if (!comuniPerRegione[regione][provinciaSigla]) {
    comuniPerRegione[regione][provinciaSigla] = []
  }
  comuniPerRegione[regione][provinciaSigla].push(comune)

  if (!provinceNames[provinciaSigla]) {
    provinceNames[provinciaSigla] = provinciaNome
  }
}

// Sort everything
const sorted = {}
for (const regione of Object.keys(comuniPerRegione).sort((a, b) => a.localeCompare(b, 'it'))) {
  const provinces = comuniPerRegione[regione]
  const sortedProvinces = {}
  for (const provincia of Object.keys(provinces).sort((a, b) => a.localeCompare(b, 'it'))) {
    sortedProvinces[provincia] = provinces[provincia].sort((a, b) => a.localeCompare(b, 'it'))
  }
  sorted[regione] = sortedProvinces
}

const output = { regions: sorted, provinceNames }

writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf-8')

const count = Object.values(sorted).reduce(
  (sum, provs) => sum + Object.values(provs).reduce((s, c) => s + c.length, 0),
  0
)

console.log(`✓ Convertiti ${count} comuni in ${Object.keys(sorted).length} regioni e ${Object.keys(provinceNames).length} province`)
console.log(`  Output: ${jsonPath}`)
