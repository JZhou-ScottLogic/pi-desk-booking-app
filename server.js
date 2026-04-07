const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname)));

app.get("/api/ical", async (req, res) => {
  const target = req.query.url;

  if (!target || typeof target !== "string") {
    return res.status(400).send("Missing url query parameter");
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).send("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).send("Only http/https URLs are allowed");
  }

  try {
    const response = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "desk-booking-reminder/1.0",
        Accept: "text/calendar,text/plain,*/*",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send(`Upstream error: HTTP ${response.status}`);
    }

    const body = await response.text();
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    return res.send(body);
  } catch (err) {
    return res.status(502).send(`Failed to fetch iCal: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Desk booking app running on http://localhost:${PORT}`);
});
