export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image" });
    }

    const puterRes = await fetch("https://api.puter.com/v2/ai/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.4-nano",
        input: [
          {
            role: "user",
            content: "Describe this image.",
            media: [image]
          }
        ]
      })
    });

    const text = await puterRes.text();

    // If Puter returns HTML, it's an error
    if (text.startsWith("<")) {
      return res.status(502).json({
        error: "Puter returned an error",
        details: text
      });
    }

    const data = JSON.parse(text);
    return res.status(200).json({ result: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
