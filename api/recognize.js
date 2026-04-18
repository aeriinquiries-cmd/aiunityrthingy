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
                    text: `Analyze the clothing item in the image and return ONLY valid JSON:

{
  "hoodieName": "<short name based ONLY on visible text or graphics>",
  "color": "<main color>",
  "keywords": "<5-10 search keywords based ONLY on what you see>",
  "brand": "<brand ONLY if clearly visible, otherwise null>"
}

Rules:
- DO NOT guess the product name.
- DO NOT invent a brand.
- hoodieName must be based ONLY on visible text or graphics.
- If no text is visible, use a simple descriptive name like "Black Graphic Hoodie".
- Respond with JSON ONLY. No explanation. No code block.`
                  },
                  {
                    inline_data: {
                      mime_type: mime,
                      data: base64
                    }
                  }
                ]
              }
            ]
          })
        }
      );

      return await response.text();
    }

    // Try primary model
    let raw = await callGemini("gemini-2.5-flash");

    // Fallback
    if (!raw || raw.startsWith("<")) {
      raw = await callGemini("gemini-1.5-flash");
    }

    // Extract JSON from inside ```json ... ```
    const match = raw.match(/\{[\s\S]*?\}/);

    let parsed;
    try {
      parsed = match ? JSON.parse(match[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      parsed = {
        hoodieName: "Unknown Item",
        color: "unknown",
        keywords: "",
        brand: null
      };
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
