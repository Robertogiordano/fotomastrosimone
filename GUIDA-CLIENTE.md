# Guida: gestire foto e video del sito fotomastrosimone.it

Questa guida spiega come aggiungere, descrivere e togliere foto e video dal sito
**senza toccare codice**. Serve solo:

- l'accesso a **Cloudinary** (dove stanno le foto)
- l'accesso al canale **YouTube** dello studio (per i video)
- facoltativo: l'accesso a **GitHub**, se vuoi far comparire subito le modifiche

---

## 1. Come funziona, in breve

- Ogni foto caricata su Cloudinary ha una **etichetta** (in Cloudinary si chiama **Tag**).
- Il tag decide **in quale galleria** del sito appare la foto.
- Ogni notte il sito controlla Cloudinary e si aggiorna da solo.

| Tag da usare | Galleria sul sito |
|---|---|
| `matrimoni` | Matrimoni |
| `bimbi`     | Bimbi |
| `studio`    | Lo studio |

> **Importante:** scrivi il tag **esattamente così**: tutto minuscolo, senza spazi,
> senza accenti. `Matrimoni` o `matrimonio` **non** funzionano.
>
> Vuoi una **galleria nuova** (es. "battesimi", "eventi")? Non inventare un tag:
> chiedi allo sviluppatore, che deve prima aggiungerla al sito.

Una foto **senza tag** (o con un tag sbagliato) resta su Cloudinary ma **non compare sul sito**.

---

## 2. Caricare nuove foto

1. Vai su **https://console.cloudinary.com** e accedi.
   Da telefono funziona allo stesso modo dal browser (Safari/Chrome).
2. Nel menu a sinistra apri **Media Library** (Libreria multimediale).
3. Apri la cartella **fotomastrosimone**, poi la cartella della galleria
   (es. `matrimoni`). La cartella aiuta a tenere ordine, ma **ciò che conta è il tag**.
4. Clicca **Upload** (in alto a destra) e trascina le foto, oppure scegli i file
   dal computer / dal rullino del telefono.
5. Aspetta che il caricamento finisca (la barra arriva al 100%).

**Consigli sulle foto**
- Formato **JPG**, lato lungo **2500–4000 pixel** è più che sufficiente.
  Il sito le ridimensiona da solo per telefoni e computer.
- Peso massimo per foto: **10 MB** (limite del piano gratuito).
- Il nome del file non è importante, ma evita nomi come `IMG_0001` se puoi:
  un nome tipo `matrimonio-cefalu-2026.jpg` aiuta anche Google.

---

## 3. Assegnare il tag (obbligatorio)

Subito dopo il caricamento:

1. Seleziona le foto appena caricate (puoi selezionarne molte insieme con la
   casellina in alto a sinistra di ogni foto).
2. Clicca **Tag** (oppure l'icona dell'etichetta 🏷) nella barra che compare in alto.
3. Scrivi il tag, per esempio `matrimoni`, e premi **Invio**.
4. Conferma con **Save / Salva**.

Per controllare: apri una foto, nel pannello a destra alla voce **Tags** deve
comparire il tag giusto.

Una foto può avere **più tag** se deve stare in più gallerie (es. `bimbi` e `studio`).

---

## 4. Scrivere la descrizione (testo alternativo)

La descrizione serve a **Google** (le foto possono comparire nelle ricerche per
immagini) e a chi usa lettori di schermo. Non è obbligatoria, ma **conviene molto**.

1. Apri la foto (doppio clic) in Media Library.
2. Nel pannello a destra trova il campo **Description** (o **Alt text**, a seconda
   della versione della pagina).
3. Scrivi **cosa si vede + dove + tipo di servizio**. Formato consigliato:

   > **Sposi sulla spiaggia di Cefalù – matrimonio**

   Altri esempi:
   - `Bimba sorridente con palloncini in studio – servizio bimbi`
   - `Sala posa con fondale bianco a Caltanissetta – studio`
   - `Primo ballo degli sposi in villa a Caltanissetta – matrimonio`

4. Salva.

**Da evitare:** testi tipo "foto 1", "IMG_2034", liste di parole chiave ripetute
("matrimonio matrimonio fotografo Caltanissetta matrimonio"). Google le penalizza.

Se lasci il campo vuoto, il sito userà una descrizione generica.

---

## 5. Eliminare o nascondere una foto

**Per toglierla dal sito ma tenerla su Cloudinary:** apri la foto, nel campo
**Tags** clicca la ✕ accanto al tag (es. `matrimoni`) e salva.

**Per eliminarla del tutto:** selezionala in Media Library → icona del cestino
(**Delete**) → conferma.

> Attenzione: una foto eliminata da Cloudinary **non si recupera**.
> Se non sei sicuro, togli solo il tag.

---

## 6. Quando si vedono le modifiche sul sito?

- **Automaticamente ogni notte**: il sito legge Cloudinary e si aggiorna. La mattina
  dopo trovi tutto online.
- **Subito, se hai fretta** (serve l'accesso a GitHub):
  1. Vai sulla pagina del progetto del sito su **github.com** (chiedi il link allo
     sviluppatore e salvalo nei preferiti).
  2. Clicca la scheda **Actions** in alto.
  3. Nella colonna di sinistra clicca **Sync gallery**.
  4. A destra clicca **Run workflow**, poi il pulsante verde **Run workflow**.
  5. Dopo 2–3 minuti compare un segno di spunta verde ✓: ricarica il sito.
     Se il browser mostra ancora la versione vecchia, aggiorna la pagina con
     **Ctrl+F5** (Windows) o **Cmd+Shift+R** (Mac), oppure riprova dopo qualche minuto.

Se invece della spunta verde compare una **✗ rossa**, nessun problema per il sito
(resta com'era): avvisa lo sviluppatore.

---

## 7. Aggiungere un video

I video del sito sono quelli della **playlist YouTube** dello studio. Per aggiungerne uno:

1. Carica il video su YouTube come al solito (da **YouTube Studio** o dall'app
   YouTube → **+** → **Carica video**).
2. Imposta la visibilità su **Pubblico** (i video "Privati" non si vedono sul sito;
   anche "Non in elenco" funziona, ma "Pubblico" aiuta a farti trovare).
3. Nella schermata dei dettagli, alla voce **Playlist**, seleziona la playlist del
   sito (quella concordata con lo sviluppatore) e salva.

   Per un video già pubblicato: aprilo su YouTube → **Salva** → spunta la playlist.
4. Fatto: il sito mostra automaticamente i video della playlist.

Per **togliere** un video dal sito basta rimuoverlo dalla playlist (non serve cancellarlo
da YouTube).

**Consiglio:** dai al video un titolo chiaro, es. *"Matrimonio a Cefalù – Giulia e Marco –
Foto Mastrosimone"*: anche il titolo aiuta su Google e YouTube.

---

## 8. Riepilogo veloce

| Voglio… | Cosa faccio |
|---|---|
| Aggiungere foto | Cloudinary → Media Library → Upload → **metti il tag** |
| Migliorare Google | Scrivo la **Description** di ogni foto |
| Togliere una foto dal sito | Tolgo il tag (oppure elimino la foto) |
| Vedere subito le modifiche | GitHub → Actions → Sync gallery → Run workflow |
| Aggiungere un video | Lo carico su YouTube e lo metto nella playlist del sito |
| Nuova galleria | Chiedo allo sviluppatore |

Dubbi o qualcosa non torna? Contatta lo sviluppatore prima di cancellare qualcosa.
