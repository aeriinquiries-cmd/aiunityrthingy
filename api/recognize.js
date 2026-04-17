export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    let body = req.body;

    // If Vercel sends body as a string, parse it
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: "Invalid JSON body", raw: req.body });
      }
    }

    if (!body) {
      return res.status(400).json({ error: "No body received", raw: req.body });
    }

    if (!body.image) {
      return res.status(400).json({ error: "Missing 'image' field", raw: body });
    }

    const response = await fetch(
      "https://api-inference.huggingface.co/models/nateraw/vit-fashion-classifier",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: body.image }),
      }
    );

    const result = await response.json();
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.toString() });
  }
}
