export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req, limitBytes = 50 * 1024 * 1024) {
  return await new Promise((resolve, reject) => {
    let data = "";
    let received = 0;

    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > limitBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      data += chunk.toString("utf8");
    });

    req.on("end", () => resolve(data));
    req.on("error", (err) => reject(err));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const raw = await readRawBody(req);
    const body = JSON.parse(raw);

    if (!body.image) {
      return res.status(400).json({ error: "Missing 'image' field" });
    }

    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    // Zero-shot clothing labels we care about
    const candidateLabels = [
      "tshirt",
      "shirt",
      "blouse",
      "tank top",
      "polo",
      "sweater",
      "hoodie",
      "jeans",
      "pants",
      "shorts",
      "skirt",
      "leggings",
      "dress",
      "gown",
      "coat",
      "jacket",
      "parka",
      "sneakers",
      "boots",
      "sandals",
      "heels",
      "hat",
      "cap",
      "scarf",
      "belt",
      "bag"
    ];

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/patrickjohncyh/fashion-clip",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: {
            image: base64,
            candidate_labels: candidateLabels
          }
        })
      }
    );

    if (!hfRes.ok) {
      const text = await hfRes.text();
      return res.status(502).json({
        error: "HuggingFace error",
        status: hfRes.status,
        body: text
      });
    }

    const hfJson = await hfRes.json();

    // HF zero-shot returns something like:
    // { labels: [...], scores: [...] }
    let label = "unknown";

    if (hfJson && Array.isArray(hfJson.labels) && hfJson.labels.length > 0) {
      label = hfJson.labels[0] || "unknown";
    }

    return res.status(200).json({
      classification: { label }
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
}
