# Desk Booking Reminder App

Mobile-friendly web app that scans your NFC card, reads the iCal URL from the card, and shows desk bookings for the current week.

## What it does

- Scans NFC card with Web NFC (`NDEFReader`)
- Reads iCal URL directly from NFC records (`url` or `text` record)
- Fetches and parses `.ics` events in-browser
- Displays bookings that overlap the current week (Mon-Sun)
- Caches card ID → iCal URL in `localStorage` for future scans
- No backend; local-only storage

## Important notes

- Web NFC requires **HTTPS** (or localhost)
- Best support: **Android Chrome**
- If iCal server blocks cross-origin requests, browser fetch may fail due to **CORS**
- If NFC is unavailable, manual fallback can only load previously cached card IDs

## Files

- `index.html` – app UI
- `styles.css` – responsive styles
- `app.js` – NFC + iCal parsing + weekly booking rendering

## Run

Open `index.html` on a secure origin (HTTPS / localhost), tap **Start NFC Scan**, then tap your card.
