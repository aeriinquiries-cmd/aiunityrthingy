// /api/searchProduct.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { caption } = req.body;
  if (!caption) {
    return res.status(400).json({ error: "Missing caption" });
  }

  const GEMINI_KEY = process.env.GOOGLE_API_KEY;
  const BING_KEY = process.env.BING_SUBSCRIPTION_KEY;

  try {
    // 1) Ask Gemini to rewrite caption into a clean product search query
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Rewrite this into a concise product search query for finding the exact clothing item online: "${caption}"`
                }
              ]
            }
          ]
        })
      }
    );

    const geminiJson = await geminiResp.json();
    const query =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
      caption;

    // 2) Call Bing Web Search API
    const bingUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(
      query
    )}&mkt=en-US`;

    const bingResp = await fetch(bingUrl, {
      headers: { "Ocp-Apim-Subscription-Key": BING_KEY }
    });

    const bingJson = await bingResp.json();

    // 3) Extract top product-like results
    const pages = bingJson.webPages?.value || [];

    const matches = pages.slice(0, 8).map((p) => {
      const title = p.name || "";
      const snippet = p.snippet || "";
      const url = p.url || "";

      // crude confidence scoring
      const confidence = /stockx|farfetch|stadiumgoods|grailed|ebay|amazon/i.test(
        url
      )
        ? 0.9
        : 0.5;

      return {
        title,
        snippet,
        url,
        confidence
      };
    });

    return res.status(200).json({
      query,
      matches
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
