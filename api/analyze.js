import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
    const { imageUrl, userBrand } = await req.json();

    console.log("Analyze request received");
    console.log("Incoming imageUrl:", imageUrl);

    // Download image
    const imgRes = await fetch(imageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64Image = Buffer.from(imgBuffer).toString("base64");

    console.log("Image downloaded, sending to Gemini...");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are an AI that extracts clothing attributes from an image.

### CRITICAL RULES:
1. ALWAYS return valid JSON only.
2. NEVER include markdown, backticks, or commentary.
3. If userBrand is provided and not empty:
   - Use userBrand as the "brand" field.
   - ONLY override it if the image clearly shows a different brand logo.
4. If no brand is visible and userBrand is empty, return "brand": null.
5. clothingName must be a simple, human-friendly name.
6. category must be a general clothing category (e.g., "Hoodie", "Jeans", "Sneakers").
7. subtype must be a more specific version of category.
8. keywords must be a list of descriptive tags.

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
    console.log("Gemini raw:", text);

    // Remove markdown or junk
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    console.log("Cleaned text:", text);

    const json = JSON.parse(text);

    // Apply brand override logic
    if (userBrand && userBrand.trim() !== "") {
      if (!json.brand || json.brand === null) {
        json.brand = userBrand.trim();
      }
    }

    console.log("Final JSON:", json);

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return new Response(
      JSON.stringify({ error: "Analyze failed", details: err.message }),
      { status: 500 }
    );
  }
}
