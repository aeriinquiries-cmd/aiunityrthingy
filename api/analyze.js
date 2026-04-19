export const runtime = "nodejs";

import { put } from "@vercel/blob";

// Discord logging helper
async function log(msg) {
  try {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "```json\n" + msg + "\n```",
      }),
    });
  } catch (e) {}
}

// Helper to read JSON body in Node.js
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

export default async function handler(req, res) {
  try {
    await log("Analyze request received");

    if (req.method !== "POST") {
      await log("Invalid method");
      return res.status(405).json({ error: "POST only" });
    }

    const { imageUrl } = await readJson(req);
    await log("Incoming imageUrl: " + imageUrl);

    if (!imageUrl) {
      await log("Missing imageUrl");
      return res.status(400).json({ error: "Missing imageUrl" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await log("Missing GEMINI_API_KEY");
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    await log("Downloading image...");
    const imgRes = await fetch(imageUrl);
    await log("Image status: " + imgRes.status);

    const imgBuffer = await imgRes.arrayBuffer();
    await log("Image size bytes: " + imgBuffer.byteLength);

    if (imgBuffer.byteLength < 500) {
      await log("ERROR: Blob returned a tiny or corrupted file");
      return res.status(400).json({ error: "Image is empty or corrupted" });
    }

    await log("Converting to base64...");
    const base64Image = Buffer.from(imgBuffer).toString("base64");
    await log("Base64 length: " + base64Image.length);

    const prompt = `
Analyze the clothing item in the image and return ONLY valid JSON.
Do NOT guess a brand unless it is clearly visible.
Be as specific as possible about the item type.

Return JSON in this format:

{
  "clothingName": "",
  "color": "",
  "brand": "",
  "category": "",
  "subtype": "",
  "keywords": []
}
`;

    await log("Sending to Gemini...");
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
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

    const data = await geminiRes.json();
    await log("Gemini raw: " + JSON.stringify(data));

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    await log("Gemini text: " + text);

    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/[\u0000-\u001F]+/g, "")
      .trim();

    await log("Cleaned text: " + cleaned);

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const jsonString = cleaned.substring(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
      await log("Parsed JSON: " + JSON.stringify(parsed));
    } catch (err) {
      await log("JSON parse error: " + err.message);
      return res.status(500).json({
        error: "Model returned invalid JSON",
        raw: cleaned,
      });
    }

    await log("Returning final JSON");
    return res.status(200).json(parsed);
  } catch (err) {
    await log("FATAL ERROR: " + err.message);
    return res.status(500).json({ error: err.message });
  }
}
