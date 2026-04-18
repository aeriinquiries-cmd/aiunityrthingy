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
      await logToDiscord("Missing Image", req.body);
      return res.status(400).json({ error: "Missing image" });
    }

    await logToDiscord("Received Image", { base64Length: image.length });

    // -----------------------------
    // PUTER AI CALL
    // -----------------------------
    const payload = {
      model: "vision",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
You are a clothing recognition AI.

Return JSON ONLY in this format:

{
  "clothingName": "...",
  "color": "...",
  "keywords": ["...", "..."],
  "brand": "... or null",
  "category": "...",
  "subtype": "..."
}

Rules:
- If brand is unclear, return null.
- If color is unclear, guess.
- If category is unclear, guess.
- NEVER return markdown.
- NEVER return commentary.
- ALWAYS return JSON.
`
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${image}`
            }
          ]
        }
      ]
    };

    const response = await fetch("https://api.puter.com/v2/ai/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    await logToDiscord("Puter Raw Response", json);

    const text = json.output_text || "";
    await logToDiscord("Puter Text Output", { text });

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

    if (!parsed) {
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

    await logToDiscord("Final Parsed JSON", parsed);

    return res.status(200).json(parsed);

  } catch (err) {
    await logToDiscord("Server Error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
