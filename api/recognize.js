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

You MUST ALWAYS return a JSON object describing the clothing item.
If the item is simple (plain pants, plain shirt, plain jeans, etc.), 
you MUST return a simple descriptive name like "black pants" or "black joggers".
NEVER return an empty response.
NEVER return null fields for clothingName, color, category, or subtype.

{
  "clothingName": "<If the item has graphics or brand cues, generate a realistic product-style name. If the item is simple, return a descriptive name like 'black pants' or 'black joggers'.>",
  "color": "<main fabric color. NEVER return null.>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "brand": "<If the item clearly matches a known brand's style, return that brand. Otherwise null.>",
  "category": "<top | bottom | shoes | outerwear | accessory | dress>",
  "subtype": "<hoodie | t-shirt | jeans | joggers | cargo pants | shorts | sneakers | boots | jacket | pants>"
}

Rules:
- If the item is plain, DO NOT infer a brand.
- If the item has graphics or text, you MAY infer the brand.
- ALWAYS return a valid JSON object.
- NEVER return an empty response.
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
