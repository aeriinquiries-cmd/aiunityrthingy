export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" }
  }
};

function isLikelyBase64Image(s) {
  if (typeof s !== "string") return false;
  if (s.startsWith("data:image/")) return true;
  const maybe = s.replace(/^data:[^;]+;base64,/, "");
  return /^[A-Za-z0-9+/=\s]+$/.test(maybe) && maybe.length > 100;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    const text = await res.text();
    // If upstream returned HTML or non-JSON, surface a clear error
    if (text.trim().startsWith("<")) {
      throw new Error("Upstream returned HTML instead of JSON");
    }
    try {
      return { ok: true, status: res.status, json: JSON.parse(text) };
    } catch (e) {
      throw new Error("Upstream returned non-JSON response");
    }
  } catch (err) {
    clearTimeout(id);
    return { ok: false, error: err };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    console.log("HANDLER START");
    console.log("REQ HEADERS:", req.headers);

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.log("Failed to parse JSON body:", e.message);
        return res.status(400).json({ error: "Invalid JSON body", raw: req.body });
      }
    }

    console.log("REQ BODY (raw):", body);

    if (!body) {
      return res.status(400).json({ error: "No body received" });
    }

    if (!body.image) {
      return res.status(400).json({ error: "Missing 'image' field", raw: body });
    }

    // Debug shortcut for local testing
    if (body.image === "test") {
      return res.status(200).json({ debug: true, message: "Test mode accepted" });
    }

    if (typeof body.image === "string" && body.image.trim().startsWith("<")) {
      console.log("Image field contains HTML or unexpected content.");
      return res.status(400).json({ error: "Invalid image content (HTML received)" });
    }

    if (!isLikelyBase64Image(body.image)) {
      return res.status(400).json({ error: "Invalid base64 image" });
    }

    // Model integration
    const MODEL_URL = process.env.MODEL_URL || "";
    const MODEL_API_KEY = process.env.MODEL_API_KEY || "";

    if (!MODEL_URL) {
      return res.status(500).json({ error: "Model endpoint not configured" });
    }

    // Build payload for your model. Adjust keys to match your model API.
    const payload = {
      image: body.image
    };

    // Call upstream model safely
    const fetchResult = await fetchJsonWithTimeout(MODEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MODEL_API_KEY ? { "Authorization": `Bearer ${MODEL_API_KEY}` } : {})
      },
      body: JSON.stringify(payload)
    }, 20000);

    if (!fetchResult.ok) {
      console.log("Upstream fetch error:", String(fetchResult.error));
      return res.status(502).json({ error: "Upstream service error", details: String(fetchResult.error.message || fetchResult.error) });
    }

    // Return upstream JSON directly but ensure it's JSON
    return res.status(200).json({ result: fetchResult.json });
  } catch (err) {
    console.error("Unhandled handler error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
