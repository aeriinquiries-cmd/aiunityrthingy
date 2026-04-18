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
                    text: `Return ONLY valid JSON describing the clothing item:

{
  "clothingName": "<short descriptive name based ONLY on what is visible>",
  "color": "<main color>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "brand": "<brand ONLY if visible, otherwise null>",
  "category": "<top | bottom | shoes | outerwear | accessory | dress>",
  "subtype": "<hoodie | t-shirt | jeans | joggers | shorts | sneakers | boots | coat | jacket | etc>"
}

- Identify the clothing item in the image.
- clothingName must be a short descriptive name (e.g., "black jeans", "white sneakers").
- category must be one of: top, bottom, shoes, outerwear, accessory, dress.
- subtype must be specific (e.g., jeans, joggers, cargo pants, hoodie, t-shirt).
- If no brand is visible, return null.
- JSON only. No markdown. No explanation.`
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

      return await response.json();
    }

    // Try primary model
    let raw = await callGemini("gemini-2.5-flash");

    // Fallback
    if (!raw || raw.candidates == null) {
      raw = await callGemini("gemini-1.5-flash");
    }

    // Extract the JSON from parts[0].text
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
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
