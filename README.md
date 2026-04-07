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
- App includes a small local proxy endpoint (`/api/ical`) to avoid browser CORS blocks when fetching iCal URLs
- If NFC is unavailable, use a deep link fallback with URL params (e.g. `?card=abc123`) to load cached card mappings
- Built-in helper UI can generate/copy iPhone Shortcut URLs for you

## Files

- `index.html` – app UI
- `styles.css` – responsive styles
- `app.js` – NFC + iCal parsing + weekly booking rendering

## iPhone fallback (no Web NFC in browser)

Use the **Shortcuts** app:

1. Create a Personal Automation triggered by NFC tag/card tap
2. Add action: **Open URLs**
3. Use your app URL with params:
   - `https://<your-app>.app.github.dev/?card=YOUR_CARD_ID`
   - optional first-time bootstrap: `https://<your-app>.app.github.dev/?card=YOUR_CARD_ID&ical=https%3A%2F%2F...`
4. First run with `&ical=...` caches it in localStorage; after that `?card=...` is enough

## Run

1. Install deps: `npm install`
2. Start app: `npm start`
3. Open the forwarded URL on HTTPS (Codespaces) or `http://localhost:8080`

The app serves static files and a local iCal proxy at `/api/ical`.
