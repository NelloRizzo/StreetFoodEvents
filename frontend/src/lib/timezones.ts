/**
 * Fusi orari proposed nel form evento.
 *
 * Non sono tutti gli ~600 fusi IANA: sarebbero una select illeggibile, e il
 * prodotto nasce per eventi di street food in Italia e dintorni. Il backend
 * (normalizeTimezone in events.controller.ts) accetta comunque qualunque fuso
 * IANA valido: questo e' solo un sottoinsieme comodo da scegliere.
 *
 * L'ordine con l'Europa/Rome in testa non e' cosmetico: e' il default del
 * model, e chi apre il form di un evento italiano non deve cercarlo nella lista.
 */
export const EVENT_TIMEZONES = [
  'Europe/Rome',
  'Europe/Reykjavik',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Prague',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Istanbul',
  'Africa/Cairo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const
