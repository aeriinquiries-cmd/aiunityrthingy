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

async function callHF(base64) {
  const url = "https://api-inference.huggingface.co/models/patrickjohncyh/fashion-clip";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 })
  });

  return res;
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

    // ⭐ RETRY LOGIC
    let hfRes = await callHF(base64);

    if (hfRes.status === 502 || hfRes.status === 503) {
      console.log("HF cold start — retrying...");
      await new Promise((r) => setTimeout(r, 1500));
      hfRes = await callHF(base64);
    }

    if (!hfRes.ok) {
      const text = await hfRes.text();
      return res.status(502).json({
        error: "HuggingFace error",
        status: hfRes.status,
        body: text
      });
    }

    const hfJson = await hfRes.json();

    let label = "unknown";
    if (Array.isArray(hfJson) && hfJson.length > 0) {
      label = hfJson[0].label || "unknown";
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
