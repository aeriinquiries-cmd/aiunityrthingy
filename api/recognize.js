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
    // GROQ CALL
    // -----------------------------
    const groqKey = process.env.GROQ_API_KEY;

    const payload = {
      model: "llava-v1.5-7b",
      messages: [
        {
          role: "user",
          content: `
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
`,
        },
      ],
      // Groq expects images in this array
      images: [`data:image/jpeg;base64,${image}`],
      temperature: 0.2
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    await logToDiscord("Groq Raw Response", json);

    const text = json?.choices?.[0]?.message?.content || "";
    await logToDiscord("Groq Text Output", { text });

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
