import { discordLog } from "./discordLog.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  await discordLog("🔥 analyze.js (OLLAMA) invoked");

  try {
    let raw = "";
    req.on("data", chunk => raw += chunk);

    const body = await new Promise(resolve => {
      req.on("end", () => resolve(raw));
    });

    const parsed = JSON.parse(body);
    const { imageUrl, userBrand } = parsed;

    if (!imageUrl) {
      res.status(400).json({ error: "Missing imageUrl" });
      return;
    }

    await discordLog("🌐 Downloading image: " + imageUrl);

    const imgRes = await fetch(imageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64Image = Buffer.from(imgBuffer).toString("base64");

    await discordLog("🧬 Base64 ready, sending to Ollama…");

const ollamaRes = await fetch("https://skimming-elk-antibody.ngrok-free.dev/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    "Host": "localhost"
  },
  body: JSON.stringify({
    model: "llava",
    prompt: `
You are an AI that extracts clothing attributes from an image.

Return ONLY valid JSON:
{
  "clothingName": "",
  "color": "",
  "brand": "",
  "category": "",
  "subtype": "",
  "keywords": []
}

Analyze the clothing in the image.
`,
    images: [base64Image]
  })
});


    const streamText = await ollamaRes.text();
    await discordLog("📨 Ollama raw output: " + streamText);

    const lastChunk = streamText.trim().split("\n").pop();
    let json;

    try {
      json = JSON.parse(lastChunk);
    } catch (err) {
      await discordLog("❌ JSON parse error: " + err.message);
      return res.status(500).json({ error: "JSON parse failed", raw: lastChunk });
    }

    if (userBrand && !json.brand) {
      json.brand = userBrand;
    }

    await discordLog("🏁 Final JSON: " + JSON.stringify(json));
    res.status(200).json(json);

  } catch (err) {
    await discordLog("💥 analyze.js crashed: " + err.message);
    res.status(500).json({ error: "Analyze failed", details: err.message });
  }
}
