# Anteprima dei poster social

Questi file **non fanno parte dell'app**: servono a guardare i poster generati
dal modulo social, cioè il codice che disegna su `<canvas>` dentro
`SocialMenuExport` e `SocialProductExport`.

Un test automatico può verificare la **geometria** (niente esce dal foglio,
la griglia non arriva sul footer — vedi `socialPosterLayout.test.ts`), ma non
se l'impaginazione *piace*: quello si vede solo guardando l'immagine.

## Come si usa

```bash
npm run dev                      # terminal 1
```

Poi, in un terminale a piacere:

```bash
chrome --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=8000 --window-size=1128,2000 \
  --screenshot=preview/story.png \
  "http://localhost:5173/preview/index.html?format=story&case=menu"
```

e aprire `preview/story.png`.

## casi disponibili

| `case` | cosa disegna |
|---|---|
| `menu` | poster del menu con 13 prodotti e prezzi |
| `menu-empty` | poster del menu di uno stand senza prodotti |
| `prod` | poster di un singolo prodotto con prezzo |
| `prod-long` | nome su più righe, senza prezzo |
| `prod-desc` | prodotto con **descrizione e prezzo**: è la combinazione in cui il prezzo passa dal contesto prima della descrizione |

Il parametro `format` è `story` (9:16, il default) o `feed` (4:5).

## Note

- Le immagini del fixture sono **assenti** (nessun `coverImage`, nessun logo,
  nessun QR): si vedono i segnaposto con l'iniziale. Serve a controllare
  l'impaginazione, non l'aspetto finale con le foto vere.
- Gli screenshot prodotti qui **non** vanno committati.
- Se aggiungi un formato, ricorda di passare per `preview` prima di dichiarare
  finita la modifica: è l'unico posto dove si vede se il testo si sovrappone.