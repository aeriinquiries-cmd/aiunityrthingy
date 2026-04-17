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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!body || !body.image) {
      return res.status(400).json({ error: "Missing 'image' field" });
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
