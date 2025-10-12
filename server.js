// server.js
const express = require("express");
const path = require("path");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();

// ---------- Middleware ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve html/css/js

// ---------- Google Sheets Setup ----------
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Helper to append a row
async function appendRowToSheet(values) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || "Sheet1";
  const range = `${sheetName}!A:Z`;

  return sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

// ---------- Routes ----------

// Insert data route
app.post("/submit", async (req, res) => {
  try {
    const { name, price, shopName, type, date, password } = req.body || {};

    if (!name || !price || !shopName || !type || !date) {
      return res.json({ success: false, error: "missing_fields" });
    }

    // Password validation
    if (password !== process.env.FORM_PASSWORD) {
      return res.json({ success: false, error: "invalid_password" });
    }

    const today = new Date().toISOString().split("T")[0];
    if (date > today) {
      return res.json({ success: false, error: "future_date" });
    }

    // IST timestamp
    const now = new Date();
    const istDate = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const [datePart, timePart] = istDate.split(", ");
    const [dd, mm, yyyy] = datePart.split("/");
    const [HH, MM, SS] = timePart.split(":");
    const timestamp = `${dd}:${mm}:${String(yyyy).slice(-2)}:${HH}:${MM}:${SS}`;

    // Ensure headers exist
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.SHEET_NAME || "Sheet1";

    const check = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:F1`,
    });

    if (!check.data.values || check.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:F1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Name", "Price", "Shop Name", "Type", "Txn_Date", "Timestamp"]],
        },
      });
    }

    // Append actual row
    await appendRowToSheet([name, price, shopName, type, date, timestamp]);
    return res.json({ success: true });

  } catch (e) {
    console.error("❌ Google Sheets error:", e.message);
    return res.status(500).json({ success: false, error: "google_api_error" });
  }
});

// Fetch all data route with password check
app.get("/data", async (req, res) => {
  try {
    const enteredPassword = req.query.password;
    if (enteredPassword !== process.env.FORM_PASSWORD) {
      return res.json({ error: "invalid_password" });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.SHEET_NAME || "Sheet1";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:F`,
    });

    res.json({ values: response.data.values || [] });
  } catch (e) {
    console.error("❌ Google Sheets fetch error:", e.message);
    res.status(500).json({ values: [] });
  }
});

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
