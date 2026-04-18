export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  let body = "";

  try {
    for await (const chunk of req) {
      body += chunk;
    }

    const data = JSON.parse(body);

    const color = data.color || "";
    const graphics = data.graphics || "";
    const text = data.text || "";
    const symbols = data.symbols || "";
    const keywords = data.keywords || "";

    if (!keywords) {
      return res.status(400).json({ error: "Missing keywords" });
    }

    // Build a strong search phrase
    const searchPhrase = `${color} hoodie ${graphics} ${text} ${symbols} ${keywords}`
      .replace(/\s+/g, " ")
      .trim();

    // Generate search URLs
    const queries = [
      `https://www.google.com/search?q=${encodeURIComponent(searchPhrase)}`,
      `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchPhrase)}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchPhrase + " stockx")}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchPhrase + " grailed")}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchPhrase + " farfetch")}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchPhrase + " ebay")}`
    ];

    return res.status(200).json({
      color,
      graphics,
      text,
      symbols,
      keywords,
      searchPhrase,
      queries
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
