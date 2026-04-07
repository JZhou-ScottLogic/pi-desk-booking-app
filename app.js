const STORAGE_KEY = "desk-booking-card-cache-v2";

const startScanBtn = document.getElementById("startScanBtn");
const stopScanBtn = document.getElementById("stopScanBtn");
const simulateBtn = document.getElementById("simulateBtn");
const manualCardId = document.getElementById("manualCardId");
const scanSupport = document.getElementById("scanSupport");
const scanStatus = document.getElementById("scanStatus");
const lastCard = document.getElementById("lastCard");
const icalLink = document.getElementById("icalLink");
const noIcal = document.getElementById("noIcal");
const loadMessage = document.getElementById("loadMessage");
const bookingList = document.getElementById("bookingList");
const savedCards = document.getElementById("savedCards");
const shortcutCardId = document.getElementById("shortcutCardId");
const shortcutIcalUrl = document.getElementById("shortcutIcalUrl");
const generateShortcutBtn = document.getElementById("generateShortcutBtn");
const copyShortcutBtn = document.getElementById("copyShortcutBtn");
const shortcutUrlOutput = document.getElementById("shortcutUrlOutput");
const shortcutStatus = document.getElementById("shortcutStatus");

let abortController = null;

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCache(cache) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

function renderCacheList() {
  const cache = loadCache();
  savedCards.innerHTML = "";
  const entries = Object.entries(cache);

  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "No cached cards yet.";
    savedCards.appendChild(li);
    return;
  }

  for (const [cardId, icalUrl] of entries) {
    const li = document.createElement("li");
    li.textContent = `${cardId} → ${icalUrl}`;
    savedCards.appendChild(li);
  }
}

function setIcalDisplay(url) {
  if (!url) {
    icalLink.classList.add("hidden");
    noIcal.classList.remove("hidden");
    return;
  }

  icalLink.href = url;
  icalLink.textContent = url;
  icalLink.classList.remove("hidden");
  noIcal.classList.add("hidden");
}

function getWeekRange(now = new Date()) {
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(current);
  start.setDate(current.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function unfoldIcsLines(icsText) {
  return icsText.replace(/\r?\n[ \t]/g, "");
}

function parseICalDate(value) {
  if (!value) return null;

  if (/^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    const h = Number(value.slice(9, 11));
    const min = Number(value.slice(11, 13));
    const s = Number(value.slice(13, 15));
    return new Date(Date.UTC(y, m, d, h, min, s));
  }

  if (/^\d{8}T\d{6}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    const h = Number(value.slice(9, 11));
    const min = Number(value.slice(11, 13));
    const s = Number(value.slice(13, 15));
    return new Date(y, m, d, h, min, s);
  }

  return null;
}

function parseIcsEvents(icsText) {
  const text = unfoldIcsLines(icsText);
  const lines = text.split(/\r?\n/);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }

    if (!current) continue;

    const firstColon = line.indexOf(":");
    if (firstColon <= 0) continue;

    const rawKey = line.slice(0, firstColon);
    const value = line.slice(firstColon + 1).trim();
    const key = rawKey.split(";")[0].toUpperCase();

    current[key] = value;
  }

  return events.map((event) => {
    const start = parseICalDate(event.DTSTART);
    const end = parseICalDate(event.DTEND) || start;
    return {
      start,
      end,
      summary: event.SUMMARY || "Booking",
      location: event.LOCATION || "",
      description: event.DESCRIPTION || "",
    };
  });
}

function overlapsWeek(event, week) {
  if (!event.start) return false;
  const end = event.end || event.start;
  return event.start < week.end && end >= week.start;
}

function extractDesk(event) {
  const source = `${event.location} ${event.summary} ${event.description}`;
  const match = source.match(/(?:desk|seat|pod)\s*[:#-]?\s*([A-Za-z0-9-]+)/i);
  if (match) return match[1];
  if (event.location) return event.location;
  return "Desk not specified";
}

function formatEventTime(date) {
  if (!date) return "Unknown time";
  return date.toLocaleString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderBookings(events) {
  bookingList.innerHTML = "";

  if (!events.length) {
    const li = document.createElement("li");
    li.textContent = "No desk bookings found for this week.";
    bookingList.appendChild(li);
    return;
  }

  for (const event of events) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${extractDesk(event)}</strong><br>${formatEventTime(event.start)} · ${event.summary}`;
    bookingList.appendChild(li);
  }
}

async function loadWeeklyBookings(icalUrl) {
  loadMessage.textContent = "Loading iCal data...";

  try {
    const proxiedUrl = `/api/ical?url=${encodeURIComponent(icalUrl)}`;
    const response = await fetch(proxiedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const icsText = await response.text();
    const week = getWeekRange();
    const events = parseIcsEvents(icsText)
      .filter((event) => overlapsWeek(event, week))
      .sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0));

    renderBookings(events);
    loadMessage.textContent = `Loaded ${events.length} booking(s) for this week.`;
  } catch (err) {
    renderBookings([]);
    loadMessage.textContent = `Could not load bookings: ${err.message}.`;
  }
}

function decodeRecord(record) {
  if (!record?.data) return "";

  try {
    const decoder = new TextDecoder(record.encoding || "utf-8");
    const text = decoder.decode(record.data).trim();

    if (record.recordType === "text") {
      // Some tags include language metadata; keep simple fallback handling.
      return text.replace(/^[a-z]{2,8}\s+/i, "");
    }

    return text;
  } catch {
    return "";
  }
}

function findIcalUrlFromRecords(records = []) {
  for (const record of records) {
    if (record.recordType === "url" || record.recordType === "text") {
      const value = decodeRecord(record);
      if (/^https?:\/\//i.test(value)) return value;
    }
  }
  return "";
}

async function processCard(cardId, icalUrlFromCard = "") {
  const id = (cardId || "").trim();
  if (!id) return;

  lastCard.textContent = id;
  manualCardId.value = id;
  if (shortcutCardId) shortcutCardId.value = id;

  const cache = loadCache();
  let icalUrl = icalUrlFromCard;

  if (icalUrl) {
    cache[id] = icalUrl;
    saveCache(cache);
    renderCacheList();
    scanStatus.textContent = `Card scanned: ${id}. iCal URL read from NFC.`;
  } else {
    icalUrl = cache[id] || "";
    scanStatus.textContent = `Card scanned: ${id}. Using cached iCal URL if available.`;
  }

  setIcalDisplay(icalUrl);

  if (!icalUrl) {
    loadMessage.textContent = "No iCal URL found on this card and no cached URL exists.";
    renderBookings([]);
    return;
  }

  await loadWeeklyBookings(icalUrl);
}

async function bootstrapFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const cardId = (params.get("card") || "").trim();
  const icalUrl = (params.get("ical") || "").trim();

  if (!cardId && !icalUrl) return;

  if (cardId) {
    manualCardId.value = cardId;
    await processCard(cardId, icalUrl);
    return;
  }

  // Supports direct `?ical=` links even without a card ID.
  setIcalDisplay(icalUrl);
  await loadWeeklyBookings(icalUrl);
}

async function startScan() {
  if (!("NDEFReader" in window)) return;

  try {
    abortController = new AbortController();
    const reader = new NDEFReader();
    await reader.scan({ signal: abortController.signal });

    startScanBtn.disabled = true;
    stopScanBtn.disabled = false;
    scanStatus.textContent = "Listening for NFC card...";

    reader.onreadingerror = () => {
      scanStatus.textContent = "NFC read error. Try tapping again.";
    };

    reader.onreading = async (event) => {
      const cardId = event.serialNumber || "unknown-card";
      const icalUrl = findIcalUrlFromRecords(event.message?.records || []);
      await processCard(cardId, icalUrl);
    };
  } catch (err) {
    scanStatus.textContent = `Could not start NFC scan: ${err.message}`;
  }
}

function stopScan() {
  if (abortController) abortController.abort();
  startScanBtn.disabled = false;
  stopScanBtn.disabled = true;
  scanStatus.textContent = "NFC scan stopped.";
}

function buildShortcutUrl(cardId, icalUrl) {
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = new URL(base);
  url.searchParams.set("card", cardId);

  if (icalUrl) {
    url.searchParams.set("ical", icalUrl);
  }

  return url.toString();
}

function generateShortcutUrl() {
  const cardId = (shortcutCardId?.value || "").trim();
  const ical = (shortcutIcalUrl?.value || "").trim();

  if (!cardId) {
    shortcutStatus.textContent = "Enter a card ID first.";
    return;
  }

  const url = buildShortcutUrl(cardId, ical);
  shortcutUrlOutput.value = url;
  shortcutStatus.textContent = "URL generated. Add this URL to your iOS Shortcut action.";
}

async function copyShortcutUrl() {
  const text = (shortcutUrlOutput?.value || "").trim();
  if (!text) {
    shortcutStatus.textContent = "Generate a URL first.";
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    shortcutStatus.textContent = "Copied to clipboard.";
  } catch {
    shortcutUrlOutput.select();
    document.execCommand("copy");
    shortcutStatus.textContent = "Copied (fallback).";
  }
}

simulateBtn.addEventListener("click", async () => {
  await processCard(manualCardId.value, "");
});

generateShortcutBtn?.addEventListener("click", generateShortcutUrl);
copyShortcutBtn?.addEventListener("click", copyShortcutUrl);

if (manualCardId && shortcutCardId) {
  manualCardId.addEventListener("input", () => {
    shortcutCardId.value = manualCardId.value;
  });
}

startScanBtn.addEventListener("click", startScan);
stopScanBtn.addEventListener("click", stopScan);

if ("NDEFReader" in window) {
  scanSupport.textContent = "Web NFC is available. Use HTTPS on Android Chrome.";
} else {
  scanSupport.textContent = "Web NFC is unavailable in this browser. On iPhone, use an NFC Shortcut that opens this page with ?card=...";
  startScanBtn.disabled = true;
}

renderCacheList();
bootstrapFromUrl().catch((err) => {
  loadMessage.textContent = `Could not load from URL parameters: ${err.message}`;
});
