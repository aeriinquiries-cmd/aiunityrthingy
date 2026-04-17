export default async function handler(req, res) {
    try {
        const { image } = req.body;

        const response = await fetch(
            "https://api-inference.huggingface.co/models/nateraw/vit-fashion-classifier",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inputs: image })
            }
        );

        const result = await response.json();
        res.status(200).json(result);

    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
}
