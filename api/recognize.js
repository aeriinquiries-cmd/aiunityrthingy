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
RETURN ONLY VALID JSON. 
NO text before or after. 
NO markdown. 
NO commentary. 
NO backticks. 
JSON OBJECT ONLY.

{
  "clothingName": "<Generate a confident, realistic product-style name. If the design strongly resembles a known streetwear brand (SP5DER, Chrome Hearts, Essentials, Bape, Vlone, etc.), infer the most likely brand and include it in the name.>",
  "color": "<main fabric color>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "brand": "<If the item clearly matches a known brand's signature style, return that brand. Otherwise null.>",
  "category": "<top | bottom | shoes | outerwear | accessory | dress>",
  "subtype": "<hoodie | t-shirt | jeans | joggers | sneakers | boots | jacket | etc>"
}

Rules:
- You ARE allowed to infer the brand if the design strongly matches a known brand's style.
- You ARE allowed to generate a realistic product-style name (e.g., “SP5DER Pink Nevermind the Spider Hoodie”).
- Do NOT output generic descriptive names unless absolutely necessary.
- Use visible graphics, text, symbols, layout, and style to determine the most likely brand.
- Color must be the literal visible fabric color.
- JSON ONLY.
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

    // ⭐ Extract ONLY the JSON block safely
    let parsed;
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const clean = text.substring(jsonStart, jsonEnd + 1);
        parsed = JSON.parse(clean);
      } else {
        parsed = null;
      }
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
