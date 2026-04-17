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

    // Extract base64
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Buffer.from(base64, "base64");

    // Call BLIP model
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream"
        },
        body: bytes
      }
    );

    const json = await hfRes.json();

    if (!hfRes.ok) {
      return res.status(502).json({
        error: "HuggingFace error",
        details: json
      });
    }

    const caption = json?.[0]?.generated_text || "unknown";

    return res.status(200).json({
      classification: { label: caption }
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
}
