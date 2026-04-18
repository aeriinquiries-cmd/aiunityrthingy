export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  let body = "";

  try {
    // Read raw request body (Vercel)
    for await (const chunk of req) {
      body += chunk;
    }

    const data = JSON.parse(body);
    const caption = data.caption;

    if (!caption) {
      return res.status(400).json({ error: "Missing caption" });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    //
    // 1) Ask ChatGPT to identify the product
    //
    const chatResp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You identify clothing products from descriptions. Respond in JSON only."
            },
            {
              role: "user",
              content: `Identify this hoodie. Return JSON with:
{
  "product": "<exact product name>",
  "color": "<color>",
  "graphics": "<graphics>",
  "text": "<text>",
  "symbols": "<symbols>",
  "keywords": "<search keywords>"
}

Description:
"${caption}"`
            }
          ]
        })
      }
    );

    const chatJson = await chatResp.json();
    let raw = chatJson?.choices?.[0]?.message?.content || "{}";

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { product: "sp5der hoodie black" };
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
