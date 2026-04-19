import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  try {
    const body = await req.json();
    const { imageUrl, userBrand } = body;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Missing imageUrl" }),
        { status: 400 }
      );
    }

    // Download image
    const imgRes = await fetch(imageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64Image = Buffer.from(imgBuffer).toString("base64");

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // Prompt
    const prompt = `
You are an AI that extracts clothing attributes from an image.

### BRAND RULES (IMPORTANT)
- If userBrand is provided and not empty:
  - Treat it as the intended brand.
  - Research the brand's typical style, graphics, fonts, colors, and design language.
  - Compare the clothing in the image to that brand's known style.
  - If the item visually matches the brand's style, return userBrand.
  - If the item clearly shows a different brand logo (Nike swoosh, Adidas stripes, etc.), override userBrand with the visible brand.
  - If no visible brand is shown, ALWAYS return userBrand.

### OUTPUT RULES
- ALWAYS return valid JSON only.
- NEVER include markdown, backticks, or commentary.
- clothingName must be simple and human-friendly.
- category must be general (Hoodie, Jeans, Sneakers).
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

    // Send to Gemini
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

    // Clean JSON
    text = text.replace(/```json/g, "")
               .replace(/```/g, "")
               .trim();

    let json = JSON.parse(text);

    // FINAL BRAND OVERRIDE
    if (userBrand && userBrand.trim() !== "") {
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
      JSON.stringify({
        error: "Analyze failed",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}
