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
    const { product, color, graphics, text, symbols } = data;

    if (!product) {
      return res.status(400).json({ error: "Missing product name" });
    }

    // Generate search queries
    const queries = [
      `https://www.google.com/search?q=${encodeURIComponent(product)}`,
      `https://www.google.com/search?q=${encodeURIComponent(product + " stockx")}`,
      `https://www.google.com/search?q=${encodeURIComponent(product + " grailed")}`,
      `https://www.google.com/search?q=${encodeURIComponent(product + " farfetch")}`,
      `https://www.google.com/search?q=${encodeURIComponent(product + " ebay")}`
    ];

    return res.status(200).json({
      product,
      color,
      graphics,
      text,
      symbols,
      queries
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
