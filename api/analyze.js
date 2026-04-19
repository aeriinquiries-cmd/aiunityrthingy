import { GoogleGenerativeAI } from "@google/generative-ai";
import { discordLog } from "./discordLog.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  await discordLog("🔥 analyze.js invoked");

  try {
    // FIXED: Node.js serverless functions use req.on("data")
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
    });

    const body = await new Promise(resolve => {
      req.on("end", () => resolve(raw));
    });

    await discordLog("📥 Raw request body: " + raw);

    const parsed = JSON.parse(raw);
    await discordLog("📥 Parsed body: " + JSON.stringify(parsed));

    const { imageUrl, userBrand } = parsed;

    if (!imageUrl) {
      await discordLog("❌ Missing imageUrl");
      res.status(400).json({ error: "Missing imageUrl" });
      return;
    }

    await discordLog("🌐 Downloading image: " + imageUrl);

    const imgRes = await fetch(imageUrl);
    await discordLog("📡 Image fetch status: " + imgRes.status);

    const imgBuffer = await imgRes.arrayBuffer();
    await discordLog("📦 Image buffer size: " + imgBuffer.byteLength);

    const base64Image = Buffer.from(imgBuffer).toString("base64");
    await discordLog("🧬 Base64 length: " + base64Image.length);

    await discordLog("🤖 Initializing Gemini…");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const result = await model.generateContent([
  {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image,
    },
  },
  {
    text: `
You are an AI that extracts clothing attributes from an image.

### BRAND REASONING (INTERNAL ONLY — DO NOT OUTPUT TEXT)
- If userBrand is provided:
  - Research the brand's typical style, graphics, fonts, colors, and design language.
  - Compare the clothing in the image to that brand's known style.
  - If the item visually matches the brand's style, set brand = userBrand.
  - If a different brand logo is clearly visible (Nike swoosh, Adidas stripes, etc.), override userBrand.
  - If no visible brand is shown, ALWAYS set brand = userBrand.
- DO NOT output your reasoning. DO NOT output explanations. Only output JSON.

### REQUIRED JSON OUTPUT (NO MARKDOWN, NO TEXT, NO COMMENTS)
{
  "clothingName": "",
  "color": "",
  "brand": "",
  "category": "",
  "subtype": "",
  "keywords": []
}

### TASK
Analyze the image and fill the JSON fields.
Return ONLY the JSON object.
`
  }
]);



    await discordLog("🚀 Sending request to Gemini…");

const result = await model.generateContent([
  {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image,
    },
  },
    await discordLog("📨 Gemini raw response: " + JSON.stringify(result));

    let text = result.response.text();
    await discordLog("📝 Gemini text output: " + text);

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    await discordLog("🧹 Cleaned JSON text: " + text);

    let json;
    try {
      json = JSON.parse(text);
      await discordLog("✅ Parsed JSON: " + JSON.stringify(json));
    } catch (parseErr) {
      await discordLog("❌ JSON parse error: " + parseErr.message);
      res.status(500).json({ error: "JSON parse failed", raw: text });
      return;
    }

    if (userBrand && userBrand.trim() !== "") {
      await discordLog("🎨 Applying brand override: " + userBrand);
      if (!json.brand || json.brand.trim() === "") {
        json.brand = userBrand.trim();
      }
    }

    await discordLog("🏁 Final JSON: " + JSON.stringify(json));

    res.status(200).json(json);

  } catch (err) {
    await discordLog("💥 analyze.js crashed: " + err.message);
    res.status(500).json({ error: "Analyze failed", details: err.message });
  }
}
