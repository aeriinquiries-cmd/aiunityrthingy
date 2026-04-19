import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req) {
  console.log("🔥 analyze.js invoked");

  try {
    const body = await req.json();
    console.log("📥 Incoming body:", body);

    const { imageUrl, userBrand } = body;

    if (!imageUrl) {
      console.error("❌ Missing imageUrl");
      return new Response(JSON.stringify({ error: "Missing imageUrl" }), { status: 400 });
    }

    console.log("🌐 Downloading image:", imageUrl);

    const imgRes = await fetch(imageUrl);
    console.log("📡 Image fetch status:", imgRes.status);

    const imgBuffer = await imgRes.arrayBuffer();
    console.log("📦 Image buffer size:", imgBuffer.byteLength);

    const base64Image = Buffer.from(imgBuffer).toString("base64");
    console.log("🧬 Base64 length:", base64Image.length);

    console.log("🤖 Initializing Gemini…");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an AI that extracts clothing attributes from an image.

### BRAND RULES
- If userBrand exists, treat it as the intended brand.
- Research the brand's style.
- If no visible brand is shown, ALWAYS return userBrand.
- Only override if a clear different brand logo is visible.

### OUTPUT FORMAT:
{
  "clothingName": "",
  "color": "",
  "brand": "",
  "category": "",
  "subtype": "",
  "keywords": []
}
`;

    console.log("🚀 Sending request to Gemini…");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
      { text: prompt },
    ]);

    console.log("📨 Gemini raw response:", result);

    let text = result.response.text();
    console.log("📝 Gemini text output:", text);

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    console.log("🧹 Cleaned JSON text:", text);

    let json;
    try {
      json = JSON.parse(text);
      console.log("✅ Parsed JSON:", json);
    } catch (parseErr) {
      console.error("❌ JSON parse error:", parseErr);
      return new Response(
        JSON.stringify({ error: "JSON parse failed", raw: text }),
        { status: 500 }
      );
    }

    // BRAND OVERRIDE
    if (userBrand && userBrand.trim() !== "") {
      console.log("🎨 Applying brand override:", userBrand);
      if (!json.brand || json.brand.trim() === "") {
        json.brand = userBrand.trim();
      }
    }

    console.log("🏁 Final JSON:", json);

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("💥 analyze.js crashed:", err);
    return new Response(
      JSON.stringify({ error: "Analyze failed", details: err.message }),
      { status: 500 }
    );
  }
}
