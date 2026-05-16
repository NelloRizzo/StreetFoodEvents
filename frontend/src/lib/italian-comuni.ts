import { useState } from 'react'
import rawData from '../data/comuni.json'

type ComuniData = Record<string, Record<string, string[]>>

type ComuneEntry = {
  name: string
  province: string
  region: string
}

type RawFile = {
  regions: ComuniData
  provinceNames: Record<string, string>
}

function isValid(data: unknown): data is RawFile {
  return typeof data === 'object' && data !== null && 'regions' in data
}

const parsed: RawFile = isValid(rawData) ? rawData : { regions: {}, provinceNames: {} }
const data = parsed.regions
const provinceNames = parsed.provinceNames

const flatComuni: ComuneEntry[] = (() => {
  const result: ComuneEntry[] = []
  for (const [region, provs] of Object.entries(data)) {
    for (const [province, cities] of Object.entries(provs)) {
      for (const name of cities) {
        result.push({ name, province, region })
      }
    }
  }
  return result
})()

export function searchComuni(query: string, region?: string, province?: string): ComuneEntry[] {
  if (!query) return []
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const results: ComuneEntry[] = []
  for (const entry of flatComuni) {
    if (region && entry.region !== region) continue
    if (province && entry.province !== province) continue
    const nameNorm = entry.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (nameNorm.startsWith(q)) {
      results.push(entry)
      if (results.length >= 20) break
    }
  }
  if (results.length < 20) {
    for (const entry of flatComuni) {
      if (region && entry.region !== region) continue
      if (province && entry.province !== province) continue
      const nameNorm = entry.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (nameNorm.includes(q) && !nameNorm.startsWith(q)) {
        if (!results.some((r) => r.name === entry.name && r.province === entry.province)) {
          results.push(entry)
          if (results.length >= 20) break
        }
      }
    }
  }
  return results
}

export function getRegions() {
  return Object.keys(data).sort((a, b) => a.localeCompare(b, 'it'))
}

export function getProvinces(region: string) {
  const provs = data[region]
  if (!provs) return []
  return Object.keys(provs).sort((a, b) => a.localeCompare(b, 'it'))
}

export function getProvinceName(sigla: string): string {
  return provinceNames[sigla] || sigla
}

export function getProvinceSigla(name: string): string | undefined {
  const entry = Object.entries(provinceNames).find(([, v]) => v === name)
  return entry?.[0]
}

export function getComuni(region: string, province: string) {
  const list = data[region]?.[province]
  if (!list) return []
  return [...list].sort((a, b) => a.localeCompare(b, 'it'))
}

export function useItalianComuni() {
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')

  const regions = getRegions()
  const provinces = getProvinces(selectedRegion)
  const comuni = getComuni(selectedRegion, selectedProvince)

  function reset() {
    setSelectedRegion('')
    setSelectedProvince('')
  }

  function onRegionChange(region: string) {
    setSelectedRegion(region)
    setSelectedProvince('')
  }

  function setRegionAndProvince(region: string, province: string) {
    setSelectedRegion(region)
    setSelectedProvince(province)
  }

  return {
    regions,
    provinces,
    comuni,
    selectedRegion,
    selectedProvince,
    setSelectedRegion: onRegionChange,
    setSelectedProvince,
    setRegionAndProvince,
    reset,
    isLoaded: regions.length > 0,
  }
}

export type { ComuneEntry }
