export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image" });
    }

    const API_KEY = process.env.GOOGLE_API_KEY;

    // Extract base64 data only
    const base64 = image.includes(",") ? image.split(",")[1] : image;

    // -----------------------------
    // Helper: Call Gemini model
    // -----------------------------
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
                  { text: "Describe this clothing item in detail. Include type, color, style, and any notable features." },
                  { inline_data: { mime_type: "image/png", data: base64 } }
                ]
              }
            ]
          })
        }
      );

      return response;
    }

    // -----------------------------
    // Retry logic (3 attempts)
    // -----------------------------
    async function tryModel(model) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await callGemini(model);
        const text = await res.text();

        // Rate limit
        if (res.status === 429) {
          if (attempt === 3) return { error: "Rate limited" };
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }

        // HTML error
        if (text.startsWith("<")) {
          return { error: "HTML error", details: text };
        }

        try {
          const data = JSON.parse(text);
          return { data };
        } catch {
          return { error: "Invalid JSON", details: text };
        }
      }
    }

    // -----------------------------
    // Primary model: Gemini 2.5 Flash
    // -----------------------------
    let result = await tryModel("gemini-2.5-flash");

    // -----------------------------
    // Fallback model: Gemini 1.5 Flash
    // -----------------------------
    if (result.error) {
      result = await tryModel("gemini-1.5-flash");
    }

    // If still error
    if (result.error) {
      return res.status(502).json({
        error: "AI model failed",
        details: result
      });
    }

    // -----------------------------
    // Extract caption text
    // -----------------------------
    const caption =
      result.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "unknown";

    // -----------------------------
    // Clothing parsing
    // -----------------------------
    function parseClothing(text) {
      const lower = text.toLowerCase();

      const types = ["shirt", "t-shirt", "hoodie", "jacket", "pants", "jeans", "shorts", "sweater", "dress", "skirt"];
      const colors = ["black", "white", "red", "blue", "green", "yellow", "gray", "brown", "purple", "pink", "orange"];

      const foundType = types.find(t => lower.includes(t)) || "unknown";
      const foundColor = colors.find(c => lower.includes(c)) || "unknown";

      return { type: foundType, color: foundColor };
    }

    const parsed = parseClothing(caption);

    // -----------------------------
    // Final response
    // -----------------------------
    return res.status(200).json({
      caption,
      clothing: parsed,
      model_used: result.data?.model || "unknown"
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
