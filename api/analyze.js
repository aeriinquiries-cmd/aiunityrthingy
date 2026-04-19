export const config = {
  runtime: "edge",
};

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
  } catch (e) {
    // ignore logging failures
  }
}

export default async function handler(req) {
  try {
    await log("Request received");

    if (req.method !== "POST") {
      await log("Invalid method");
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
      });
    }

    const { imageUrl } = await req.json();
    await log("Incoming imageUrl: " + imageUrl);

    if (!imageUrl) {
      await log("Missing imageUrl");
      return new Response(JSON.stringify({ error: "Missing imageUrl" }), {
        status: 400,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await log("Missing GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
        status: 500,
      });
    }

    // 1. Download the image
    await log("Downloading image...");
    const imgRes = await fetch(imageUrl);
    await log("Image status: " + imgRes.status);

    const imgBuffer = await imgRes.arrayBuffer();
    await log("Image size bytes: " + imgBuffer.byteLength);

    // Edge-safe base64 conversion
    await log("Converting to base64...");
    const base64Image = btoa(
      String.fromCharCode(...new Uint8Array(imgBuffer))
    );
    await log("Base64 length: " + base64Image.length);

    const prompt = `
Return ONLY valid JSON. No markdown. No commentary. No backticks.

{
  "clothingName": "",
  "color": "",
  "brand": "",
  "category": "",
  "subtype": "",
  "keywords": []
}
`;

    // 2. Send to Gemini
    await log("Sending to Gemini...");
const geminiRes = await fetch(
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=" +
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

    // CLEAN OUTPUT
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/[\u0000-\u001F]+/g, "")
      .trim();

    await log("Cleaned text: " + cleaned);

    // EXTRACT JSON
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const jsonString = cleaned.substring(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
      await log("Parsed JSON: " + JSON.stringify(parsed));
    } catch (err) {
      await log("JSON parse error: " + err.message);
      return new Response(
        JSON.stringify({
          error: "Model returned invalid JSON",
          raw: cleaned,
        }),
        { status: 500 }
      );
    }

    await log("Returning final JSON");

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await log("FATAL ERROR: " + err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
