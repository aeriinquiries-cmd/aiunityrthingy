export default async function handler(req, res) {
  console.log("🔥 API HIT");

  if (req.method !== "POST") {
    console.log("❌ Wrong method:", req.method);
    return res.status(405).json({ error: "POST only" });
  }

  try {
    console.log("📥 RAW BODY:", req.body);

    const { image } = req.body || {};

    if (!image) {
      console.log("❌ IMAGE MISSING IN BODY");
      return res.status(400).json({ error: "Missing image" });
    }

    console.log("📏 BASE64 LENGTH:", image.length);

    const API_KEY = process.env.GEMINI_API_KEY;

    async function callGemini(model) {
      console.log(`🤖 Calling Gemini model: ${model}`);

      const payload = {
        contents: [
          {
            parts: [
              {
                text: `
RETURN ONLY VALID JSON.
NO markdown.
NO commentary.
JSON ONLY.

{
  "clothingName": "<name>",
  "color": "<color>",
  "keywords": ["k1","k2"],
  "brand": "<brand or null>",
  "category": "<top|bottom|shoes|outerwear|accessory|dress>",
  "subtype": "<hoodie|pants|jeans|etc>"
}
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
      };

      console.log("📤 SENDING TO GEMINI:", JSON.stringify(payload).slice(0, 200), "...");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      console.log("📥 GEMINI STATUS:", response.status);

      const json = await response.json();

      console.log("📥 GEMINI RAW RESPONSE:", JSON.stringify(json).slice(0, 500));

      return json;
    }

    // Try Gemini 2.5 Flash first
    let raw = await callGemini("gemini-2.5-flash");

    // Fallback to 1.5 Flash if needed
    if (!raw || !raw.candidates) {
      console.log("⚠️ Fallback to 1.5 Flash");
      raw = await callGemini("gemini-1.5-flash");
    }

    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("📄 GEMINI TEXT OUTPUT:", text);

    // Try to extract JSON
    let parsed = null;
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");

      if (start !== -1 && end !== -1) {
        const jsonString = text.slice(start, end + 1);
        console.log("📦 JSON STRING:", jsonString);
        parsed = JSON.parse(jsonString);
      } else {
        console.log("❌ JSON BRACES NOT FOUND");
      }
    } catch (e) {
      console.log("❌ JSON PARSE ERROR:", e.message);
      parsed = null;
    }

    if (!parsed) {
      console.log("❌ PARSING FAILED — RETURNING DEBUG");
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

    console.log("✅ FINAL PARSED JSON:", parsed);

    return res.status(200).json(parsed);

  } catch (err) {
    console.log("💥 SERVER ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
