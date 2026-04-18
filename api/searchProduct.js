export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  let body = "";

  try {
    // Read raw request body (required on Vercel)
    for await (const chunk of req) {
      body += chunk;
    }

    const data = JSON.parse(body);
    const caption = data.caption;

    if (!caption) {
      return res.status(400).json({ error: "Missing caption" });
    }

    const GEMINI_KEY = process.env.GOOGLE_API_KEY;
    const BING_KEY = process.env.BING_SUBSCRIPTION_KEY;

    //
    // 1) Ask Gemini to identify the exact product name
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
                  text: `Identify the exact product name for this hoodie. 
Return ONLY the product name, nothing else:

"${caption}"`
                }
              ]
            }
          ]
        })
      }
    );

    const identifyJson = await identifyResp.json();
    let productName =
      identifyJson?.candidates?.[0]?.content?.parts?.[0]?.text || caption;

    productName = productName.replace(/[“”]/g, '"').trim();

    //
    // 2) Ask Gemini to extract key attributes (color, graphics, text)
    //
    const attrResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract the key attributes of this hoodie. 
Return JSON with fields: color, text, graphics, symbols.

"${caption}"`
                }
              ]
            }
          ]
        })
      }
    );

    const attrJson = await attrResp.json();
    let attributesText =
      attrJson?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let attributes;
    try {
      attributes = JSON.parse(attributesText);
    } catch {
      attributes = {};
    }

    const expectedColor = (attributes.color || "").toLowerCase();
    const expectedText = (attributes.text || "").toLowerCase();
    const expectedGraphics = (attributes.graphics || "").toLowerCase();
    const expectedSymbols = (attributes.symbols || "").toLowerCase();

    //
    // 3) Search Bing using ONLY the product name
    //
    const bingUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(
      productName
    )}&mkt=en-US`;

    const bingResp = await fetch(bingUrl, {
      headers: { "Ocp-Apim-Subscription-Key": BING_KEY }
    });

    const bingJson = await bingResp.json();
    const pages = bingJson.webPages?.value || [];

    //
    // 4) Filter results by color + design match
    //
    const matches = pages
      .filter((p) => {
        const text = `${p.name} ${p.snippet}`.toLowerCase();

        const colorMatch = expectedColor
          ? text.includes(expectedColor)
          : true;

        const textMatch = expectedText
          ? text.includes("sp5der") || text.includes("spider")
          : true;

        const graphicsMatch = expectedGraphics
          ? text.includes("web") || text.includes("spiderweb")
          : true;

        const starsMatch = expectedSymbols
          ? text.includes("star")
          : true;

        return colorMatch && textMatch && graphicsMatch && starsMatch;
      })
      .slice(0, 8)
      .map((p) => ({
        title: p.name || "",
        snippet: p.snippet || "",
        url: p.url || "",
        confidence: 0.95
      }));

    return res.status(200).json({
      query: productName,
      attributes,
      matches
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
