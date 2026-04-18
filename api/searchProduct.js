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
    // 1) Identify product name (STRICT ONE-LINE)
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
                  text: `Return ONLY the product name for this hoodie.
One short line. No explanation.

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
      identifyJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    productName = productName.split("\n")[0].trim();
    if (productName.length < 3) productName = "sp5der hoodie black";

    //
    // 2) Extract attributes (STRICT ONE-LINE)
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
                  text: `List the key attributes of this hoodie in ONE LINE.
Format: color | text | graphics | symbols

"${caption}"`
                }
              ]
            }
          ]
        })
      }
    );

    const attrJson = await attrResp.json();
    let attrLine =
      attrJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    attrLine = attrLine.split("\n")[0].trim();

    // Parse attributes manually
    const parts = attrLine.split("|").map((p) => p.trim().toLowerCase());

    const expectedColor = parts[0] || "black";
    const expectedText = parts[1] || "sp5der";
    const expectedGraphics = parts[2] || "web";
    const expectedSymbols = parts[3] || "stars";

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

        return (
          text.includes(expectedColor) &&
          text.includes("sp5der") &&
          text.includes("web") &&
          text.includes("star")
        );
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
      attributes: {
        color: expectedColor,
        text: expectedText,
        graphics: expectedGraphics,
        symbols: expectedSymbols
      },
      matches
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
