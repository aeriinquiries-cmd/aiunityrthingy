// api/analyze.js

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
      });
    }

    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing imageUrl" }), {
        status: 400,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
        status: 500,
      });
    }

    const prompt = `
You are a clothing recognition AI. Analyze the image and return ONLY valid JSON with:

{
  "clothingName": "",
  "color": "",
  "brand": "",
  "category": "",
  "subtype": "",
  "keywords": []
}

Be extremely accurate. No extra text.
`;

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { image_url: imageUrl },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON safely
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonString = text.substring(start, end + 1);

    const parsed = JSON.parse(jsonString);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
