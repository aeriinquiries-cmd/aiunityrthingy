export const config = {
  api: {
    bodyParser: false
  }
};

// Read raw request body (since bodyParser is disabled)
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
    // 1) Read raw body
    const raw = await readRawBody(req);

    // 2) Parse JSON
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // 3) Get image field
    if (!body.image) {
      return res.status(400).json({ error: "Missing 'image' field" });
    }

    // 4) Strip data URL prefix if present
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    // 5) Call HuggingFace Fashion-CLIP model
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/patrickjohncyh/fashion-clip",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64
        })
      }
    );

    if (!hfRes.ok) {
      const text = await hfRes.text();
      console.error("HF error:", hfRes.status, text);
      return res
        .status(502)
        .json({ error: "HuggingFace error", status: hfRes.status, body: text });
    }

    const hfJson = await hfRes.json();

    // 6) Extract top label
    let label = "unknown";
    if (Array.isArray(hfJson) && hfJson.length > 0) {
      // Many HF classifiers return [{label, score}, ...]
      label = hfJson[0].label || "unknown";
    }

    // 7) Respond in the exact shape Unity expects
    return res.status(200).json({
      classification: {
        label
      }
    });
  } catch (err) {
    console.error("Server error:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
}
