export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image" });
    }

    const API_KEY = process.env.GEMINI_API_KEY;

    // Flutter sends raw base64 (no prefix)
    const mime = "image/jpeg";
    const base64 = image;

    async function callGemini(model) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
{
  text: `Analyze the hoodie in the image and return ONLY JSON:

{
  "color": "<main color>",
  "graphics": "<graphics or artwork>",
  "text": "<visible text>",
  "symbols": "<symbols or shapes>",
  "keywords": "<5-10 search keywords based ONLY on what you see>"
}

Rules:
- DO NOT guess the product name.
- DO NOT guess the brand.
- DO NOT invent a hoodie model.
- ONLY describe what is visually present.
- JSON only. No explanation.`
}
                  },
                  { inline_data: { mime_type: mime, data: base64 } }
                ]
              }
            ]
          })
        }
      );

      const text = await response.text();

      if (!text || text.startsWith("<")) {
        return { error: "Google returned HTML or empty response", details: text };
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return { error: "Invalid JSON from Google", details: text };
      }

      return { data };
    }

    // Primary model
    let result = await callGemini("gemini-2.5-flash");

    // Fallback
    if (result.error) {
      result = await callGemini("gemini-1.5-flash");
    }

    if (result.error) {
      return res.status(502).json({
        error: "AI model failed",
        details: result
      });
    }

    // Extract JSON text from Gemini
    const rawText =
      result.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { product: "Unknown Hoodie", color: "unknown" };
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
