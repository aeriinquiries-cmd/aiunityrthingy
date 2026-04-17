export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image" });
    }

    const puterRes = await fetch("https://api.puter.com/v2/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Describe this image." }
        ],
        media: [image],
        model: "openai/gpt-5.4-nano"
      })
    });

    const data = await puterRes.json();
    return res.status(200).json({ result: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
