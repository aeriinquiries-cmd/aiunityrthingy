export const config = {
  api: {
    bodyParser: false
  }
};

// small helper to read the raw request body
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

function isLikelyBase64Image(s) {
  if (typeof s !== "string") return false;
  if (s.startsWith("data:image/")) return true;
  const maybe = s.replace(/^data:[^;]+;base64,/, "");
  return /^[A-Za-z0-9+/=\s]+$/.test(maybe) && maybe.length > 100;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    // Read raw body (works even if automatic JSON parsing would fail)
    const raw = await readRawBody(req, 50 * 1024 * 1024); // 50 MB limit
    if (!raw) {
      return res.status(400).json({ error: "No body received" });
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      // Return a helpful error and a short snippet of the raw body for debugging
      const snippet = raw.slice(0, 200);
      return res.status(400).json({ error: "Invalid JSON", snippet });
    }

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid JSON structure", rawType: typeof body });
    }

    if (!body.image) {
      return res.status(400).json({ error: "Missing 'image' field", raw: Object.keys(body) });
    }

    // Debug shortcut
    if (body.image === "test") {
      return res.status(200).json({ debug: true, message: "Test mode accepted" });
    }

    if (typeof body.image === "string" && body.image.trim().startsWith("<")) {
      return res.status(400).json({ error: "Invalid image content (HTML received)" });
    }

    if (!isLikelyBase64Image(body.image)) {
      return res.status(400).json({ error: "Invalid base64 image" });
    }

    // If no MODEL_URL configured, return a mocked classification result
    if (!process.env.MODEL_URL) {
      return res.status(200).json({
        mock: true,
        classification: { label: "mocked_label", confidence: 0.72 },
        note: "No MODEL_URL configured; this is a mock response for development"
      });
    }

    // If MODEL_URL exists, call it (kept simple and safe)
    try {
      const MODEL_URL = process.env.MODEL_URL;
      const MODEL_API_KEY = process.env.MODEL_API_KEY || "";

      const headers = {
        "Content-Type": "application/json",
        ...(MODEL_API_KEY ? { "Authorization": `Bearer ${MODEL_API_KEY}` } : {})
      };

      const resp = await fetch(MODEL_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ image: body.image })
      });

      const text = await resp.text();
      if (text.trim().startsWith("<")) {
        return res.status(502).json({ error: "Upstream returned HTML" });
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        return res.status(502).json({ error: "Upstream returned non-JSON" });
      }
      return res.status(200).json({ result: json });
    } catch (err) {
      console.log("Upstream fetch error:", String(err && err.message ? err.message : err));
      return res.status(502).json({ error: "Upstream service error", details: String(err && err.message ? err.message : err) });
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
