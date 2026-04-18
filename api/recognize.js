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
                    text: `
Return ONLY valid JSON describing the clothing item in the image.

{
"clothingName": "<a short, creative name based on visible graphics, text, symbols, and style. Do NOT invent brands, but DO create a unique descriptive name, and only put the brand if you know that is for sure the brand>",
  "color": "<main color>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "brand": "<brand ONLY if visible, otherwise null>",
  "category": "<top | bottom | shoes | outerwear | accessory | dress>",
  "subtype": "<hoodie | t-shirt | jeans | joggers | shorts | sneakers | boots | coat | jacket | etc>"
}

Rules:
- Identify the clothing item in the image.
- clothingName must be a short descriptive name (e.g., "black jeans", "white sneakers").
- category must be one of: top, bottom, shoes, outerwear, accessory, dress.
- subtype must be specific (e.g., jeans, joggers, cargo pants, hoodie, t-shirt).
- If no brand is visible, return null.
- Color must be the literal visible color of the fabric.
- Ignore lighting reflections or warm indoor lighting when determining color.
- JSON only. No markdown. No explanation.
`
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

    // Try Gemini 2.5 Flash first
    let raw = await callGemini("gemini-2.5-flash");

    // Fallback to 1.5 Flash if needed
    if (!raw || raw.candidates == null) {
      raw = await callGemini("gemini-1.5-flash");
    }

    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    // Fallback if parsing fails
    if (!parsed) {
      parsed = {
        clothingName: "Unknown Item",
        color: "unknown",
        keywords: [],
        brand: null,
        category: "unknown",
        subtype: "unknown",
      };
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
