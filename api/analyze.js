import { GoogleGenerativeAI } from "@google/generative-ai";
import { discordLog } from "./discordLog.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req) {
  await discordLog("🔥 analyze.js invoked");

  try {
    // FIXED: Node.js runtime does NOT support req.json()
    const raw = await req.text();
    await discordLog("📥 Raw request body: " + raw);

    const body = JSON.parse(raw);
    await discordLog("📥 Parsed body: " + JSON.stringify(body));

    const { imageUrl, userBrand } = body;

    if (!imageUrl) {
      await discordLog("❌ Missing imageUrl");
      return new Response(JSON.stringify({ error: "Missing imageUrl" }), { status: 400 });
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

    const prompt = `
You are an AI that extracts clothing attributes from an image.
(… your prompt unchanged …)
`;

    await discordLog("🚀 Sending request to Gemini…");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
      { text: prompt },
    ]);

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
      return new Response(
        JSON.stringify({ error: "JSON parse failed", raw: text }),
        { status: 500 }
      );
    }

    if (userBrand && userBrand.trim() !== "") {
      await discordLog("🎨 Applying brand override: " + userBrand);
      if (!json.brand || json.brand.trim() === "") {
        json.brand = userBrand.trim();
      }
    }

    await discordLog("🏁 Final JSON: " + JSON.stringify(json));

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    await discordLog("💥 analyze.js crashed: " + err.message);
    return new Response(
      JSON.stringify({ error: "Analyze failed", details: err.message }),
      { status: 500 }
    );
  }
}
