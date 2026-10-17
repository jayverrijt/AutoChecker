# ⚡ Picnic Teamwork Vrijcheck App & Slack Bot

Een mobiele webapp met exact het uiterlijk en gevoel van de **Picnic Teamwork app** (met o.a. de hangende Picnic-peertje, dark mode, weekoverzicht en shiftcards), gekoppeld aan een geautomatiseerde **Slack Bot** die razendsnel kan reageren op de dagelijkse planningsberichten van `Day-Planning-Sender` in `#nl-dist-runners-hlm`.

---

## 🎯 Hoe Werkt Het?

1. **Geen Keycloak OAuth nodig**: Je kiest per dag zelf welk shiftblok je hebt ingeroosterd (`M1`, `M2`, `S1`, `S2`, `S3` of `Geen shift`).
2. **Slack Monitoring**: De bot monitort het kanaal `#nl-dist-runners-hlm` op berichten van `Day-Planning-Sender`.
3. **Automatische Snelle Reactie**:
   - Bericht bevat **OCHTEND** of **MIDDAG** met de datum (bijv. `MIDDAG 17-10-2026`).
   - Matcht met jouw ingeroosterde shiftblok:
     - **M1** (Ochtend 1) ➜ Reageert met `:1-red:`
     - **M2** (Ochtend 2) ➜ Reageert met `:2-red:`
     - **S1** (Middag 1)  ➜ Reageert met `:1-red:`
     - **S2** (Middag 2)  ➜ Reageert met `:2-red:`
     - **S3** (Middag 3)  ➜ Reageert met `:3-red:`
4. **Visuele Bevestiging**: Zodra de reactie geplaatst is, kleurt de shiftkaart in de Teamwork app groen/blauw met een feestelijke badge (bijv. `🎉 Gereageerd met :1-red: (184ms)`) en een notificatiegeluid.

---

## 🚀 Snelle Start

### 1. Starten in Development Modus
```bash
# Start zowel de backend server als de Vite client tegelijk:
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173) (of via je netwerk IP op je telefoon!)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

### 2. Starten in Production Modus (Alles-in-één op poort 3001)
```bash
npm start
```
Open direct [http://localhost:3001](http://localhost:3001).

---

## 🧪 Ingebouwde Simulatiemodus (Testen zonder Slack Token)

Geen Slack token bij de hand? Geen probleem!
1. Ga naar het tabblad **Slack Live** onderin.
2. Je ziet daar een preview van het exacte Slack-bericht van `Day-Planning-Sender` (zoals in jouw schermafbeelding).
3. Klik op **"Verzend gesimuleerd bericht in Slack"**.
4. De bot detecteert direct welke shift (`M1`-`S3`) je voor die dag hebt ingesteld, berekent de juiste emoji (`:1-red:`, `:2-red:`, of `:3-red:`), plaatst de reactie met realistische latency en toont confetti + successtatus!

---

## ⚙️ Echte Slack Verbinding Instellen

Ga in de app naar het tabblad **Instellingen**:
1. Vul je **Slack Token** in:
   - **Persoonlijke User Token (`xoxp-...`)**: Aanbevolen als je wilt dat de reactie uit jouw eigen naam wordt geplaatst. Permissies: `reactions:write`, `channels:history`, `channels:read`.
   - **Bot Token (`xoxb-...`)**: Als je een Slack App hebt geïnstalleerd in de workspace.
2. Kanaalnaam: `#nl-dist-runners-hlm`
3. Klik op **Instellingen Opslaan & Herverbinden**.
