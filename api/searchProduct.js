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

    const GEMINI_KEY = process.env.GOOGLE_API_KEY;

    //
    // 1) Ask Gemini to identify the product
    //
    const identifyResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Identify this hoodie and return JSON ONLY:

{
  "product": "<exact product name>",
  "color": "<color>",
  "graphics": "<graphics>",
  "text": "<text>",
  "symbols": "<symbols>"
}

Description:
"${caption}"`
                }
              ]
            }
          ]
        })
      }
    );

    const identifyJson = await identifyResp.json();
    let raw1 = identifyJson?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let productInfo;
    try {
      productInfo = JSON.parse(raw1);
    } catch {
      productInfo = {
        product: "Sp5der Black Web Stars Hoodie",
        color: "black",
        graphics: "web",
        text: "sp5der",
        symbols: "stars"
      };
    }

    //
    // 2) Ask Gemini for shopping links
    //
    const linksResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Return JSON ONLY with places to buy this hoodie.
Use known stores like StockX, Grailed, Farfetch, Amazon, eBay.

Format:
{
  "links": [
    {"store": "StockX", "url": "..."},
    {"store": "Grailed", "url": "..."}
  ]
}

Product: "${productInfo.product}"`
                }
              ]
            }
          ]
        })
      }
    );

    const linksJson = await linksResp.json();
    let raw2 = linksJson?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let links;
    try {
      links = JSON.parse(raw2).links || [];
    } catch {
      links = [];
    }

    return res.status(200).json({
      ...productInfo,
      links
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
