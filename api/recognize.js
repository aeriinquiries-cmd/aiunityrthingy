import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // IMPORTANT: disable body parser for multipart
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    // Parse multipart form
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: "Form parsing failed" });
      }

      const file = files.image;
      if (!file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      // Read file buffer
      const imageBuffer = fs.readFileSync(file.filepath);
      const base64Image = imageBuffer.toString("base64");

      // Call Gemini
      const API_KEY = process.env.GEMINI_API_KEY;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
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
NO markdown. NO commentary. JSON ONLY.

{
  "clothingName": "<If simple, use descriptive name>",
  "color": "<main fabric color>",
  "keywords": ["<keyword1>", "<keyword2>"],
  "brand": "<brand or null>",
  "category": "<top | bottom | shoes | outerwear | accessory | dress>",
  "subtype": "<hoodie | pants | jeans | joggers | etc>"
}
                    `,
                  },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const raw = await response.json();
      const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Extract JSON
      let parsed = null;
      try {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(text.slice(start, end + 1));
        }
      } catch {}

      if (!parsed) {
        return res.status(200).json({
          clothingName: "ParsingError",
          rawResponse: text,
        });
      }

      return res.status(200).json(parsed);
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
