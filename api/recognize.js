export default async function handler(req, res) {
  console.log("🔥 API HIT");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // -----------------------------
  // DISCORD LOGGER
  // -----------------------------
  async function logToDiscord(label, data) {
    try {
      const webhook = process.env.DISCORD_WEBHOOK;
      if (!webhook) return;

      const message =
        `**${label}**\n` +
        "```json\n" +
        JSON.stringify(data, null, 2).slice(0, 1900) +
        "\n```";

      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message })
      });
    } catch (e) {
      console.log("❌ Discord logging failed:", e.message);
    }
  }

  try {
    const { image } = req.body || {};

    if (!image) {
      console.log("❌ Missing image in body");
      await logToDiscord("Missing Image", req.body);
      return res.status(400).json({ error: "Missing image" });
    }

    console.log("📏 Base64 length:", image.length);
    await logToDiscord("Received Image", { base64Length: image.length });

    const API_KEY = process.env.GEMINI_API_KEY;

    // -----------------------------
    // PROMPT
    // -----------------------------
    const PROMPT = `
You are a clothing recognition AI.

ALWAYS return JSON. If unsure, make your best guess.

FORMAT:
{
  "clothingName": "...",
  "color": "...",
  "keywords": ["...", "..."],
  "brand": "... or null",
  "category": "...",
  "subtype": "..."
}

RULES:
- If the brand is unclear, return null.
- If the item is simple (plain shirt, plain pants), return a simple descriptive name.
- NEVER return an empty string.
- NEVER return markdown.
- ALWAYS return JSON.
`;

    // -----------------------------
    // GEMINI CALL
    // -----------------------------
    async function callGemini() {
      const payload = {
        contents: [
          {
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: image
                }
              }
            ]
          }
        ]
      };

      console.log("🤖 Calling Gemini: gemini-1.5-flash");
      await logToDiscord("Calling Gemini", { model: "gemini-1.5-flash" });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      console.log("📥 Gemini status:", response.status);

      const json = await response.json();
      await logToDiscord("Gemini Raw Response", json);

      return json;
    }

    // -----------------------------
    // CALL MODEL
    // -----------------------------
    const raw = await callGemini();

    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📄 Gemini text:", text);
    await logToDiscord("Gemini Text Output", { text });

    // -----------------------------
    // JSON EXTRACTION
    // -----------------------------
    function extractJSON(str) {
      try {
        const match = str.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch (e) {
        console.log("❌ JSON parse error:", e.message);
      }
      return null;
    }

    const parsed = extractJSON(text);

    // -----------------------------
    // FINAL FALLBACK
    // -----------------------------
    if (!parsed) {
      console.log("❌ Parsing failed — returning debug");
      await logToDiscord("Parsing Failed", { rawResponse: text });

      return res.status(200).json({
        clothingName: "ParsingError",
        color: null,
        keywords: [],
        brand: null,
        category: null,
        subtype: null,
        rawResponse: text
      });
    }

    console.log("✅ Final parsed JSON:", parsed);
    await logToDiscord("Final Parsed JSON", parsed);

    return res.status(200).json(parsed);

  } catch (err) {
    console.log("💥 SERVER ERROR:", err);
    await logToDiscord("Server Error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
