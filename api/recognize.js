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
RETURN ONLY VALID JSON.
NO text before or after.
NO markdown.
NO commentary.
NO backticks.
JSON OBJECT ONLY.

{
  "clothingName": "<If the item has distinctive graphics, text, symbols, or brand cues, generate a realistic product-style name. If the item is simple (plain pants, plain shirt, plain jeans, etc.), return a clean descriptive name like 'black cargo pants' or 'black joggers'.>",
  "color": "<main fabric color>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "brand": "<If the item clearly matches a known brand's signature style, return that brand. Otherwise null.>",
  "category": "<top | bottom | shoes | outerwear | accessory | dress>",
  "subtype": "<hoodie | t-shirt | jeans | joggers | cargo pants | shorts | sneakers | boots | jacket | etc>"
}

Rules:
- If the item has no graphics, text, or brand cues, DO NOT infer a brand. Use a simple descriptive name.
- If the item has distinctive graphics or text, you ARE allowed to infer the brand.
- Always return a valid JSON object.
- Color must be the literal visible fabric color.
- JSON ONLY.
                    `
                  },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: image
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
    if (!raw || !raw.candidates) {
      raw = await callGemini("gemini-1.5-flash");
    }

    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // ⭐ Bulletproof JSON extraction
    let parsed = null;
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");

      if (start !== -1 && end !== -1) {
        const jsonString = text.slice(start, end + 1);
        parsed = JSON.parse(jsonString);
      }
    } catch (e) {
      parsed = null;
    }

    // If parsing failed, return structured debug info
    if (!parsed) {
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

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
