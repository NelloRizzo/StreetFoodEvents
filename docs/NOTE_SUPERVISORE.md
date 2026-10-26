# Note del Supervisore
_(Le note vanno analizzate e per ognuna va presa una decisione: implementazione e registrazione immediata in CHANGELOG o spostamento nei TODO)_

- Nella cassa di cambio, il caricamento e i rimborsi devono tener conto delle disponibilità della cassa e non del cliente. Si deve guardare al cliente solo se è selezionato un cliente reale (per default è "Non collegato a clienti"): nel caso di un cliente reale, non si può rimborsare più crediti di quelli posseduti

- All'apertura di una cassa impostiamo delle soglie di sicurezza di 100 per gli euro e i soldi, così non ci si deve ricordare di configurare la scelta ad ogni apertura della cassa. 

- All'apertura di una cassa lasciamo collassata la sezione di richiesta alla cassa master, mentre apriamo la sezione di fondo cassa. La sezione di fondo cassa dovrebbe avere un contenitore organizzato come quello della richiesta alla cassa master (bordo e sfondo) con lo stesso gap superiore

- Nel rimborso, riduciamo la lunghezza della textbox dell'importo e mettiamo in linea la conversione in euro (adesso si trova in una riga tutta sua) che sarà ricalcolata alla perdita del focus della textbox. Modifichiamo il gap orizzontale tra le etichette "Incasso con" "Restituisci con" e le rispettive inputbox

- Nella cassa Aumentare i gap verticali tra selectbox, il saldo (può andare in orizzontale dopo il pulsante crea) e il titolo della sezione successiva
