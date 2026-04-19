import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: "nodejs",
};


export default async function handler(req) {
  try {
    const { imageUrl, userBrand } = await req.json();

    const imgRes = await fetch(imageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64Image = Buffer.from(imgBuffer).toString("base64");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are an AI that extracts clothing attributes from an image.

### BRAND RULES (IMPORTANT)
1. If userBrand is provided and not empty:
   - Treat it as the *intended* brand.
   - Research the brand's typical style, graphics, fonts, colors, and design language.
   - Compare the clothing in the image to that brand's known style.
   - If the item visually matches the brand's style, return userBrand.
   - If the item clearly shows a different brand logo (e.g., Nike swoosh, Adidas stripes), override userBrand with the visible brand.
   - If no visible brand is shown, ALWAYS return userBrand.

### OUTPUT RULES
- ALWAYS return valid JSON only.
- NEVER include markdown, backticks, or commentary.
- clothingName must be a simple, human-friendly name.
- category must be general (e.g., "Hoodie", "Jeans", "Sneakers").
- subtype must be more specific.
- keywords must be descriptive tags.

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

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
      { text: prompt },
    ]);

    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const json = JSON.parse(text);

    // FINAL BRAND OVERRIDE LOGIC
    if (userBrand && userBrand.trim() !== "") {
      // If Gemini didn't detect a different brand, force userBrand
      if (!json.brand || json.brand.trim() === "") {
        json.brand = userBrand.trim();
      }
    }

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Analyze failed", details: err.message }),
      { status: 500 }
    );
  }
}
