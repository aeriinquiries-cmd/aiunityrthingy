export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

function isLikelyBase64Image(s) {
  if (typeof s !== "string") return false;
  // common data URL prefix
  if (s.startsWith("data:image/")) return true;
  // rough base64 check (no padding/linebreak strictness)
  const maybe = s.replace(/^data:[^;]+;base64,/, "");
  return /^[A-Za-z0-9+/=\s]+$/.test(maybe) && maybe.length > 100;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    // Log entry for debugging in Vercel logs
    console.log("HANDLER START");
    console.log("REQ HEADERS:", req.headers);

    let body = req.body;

    // If Vercel or client sent a string, try to parse it safely
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
      return res.status(400).json({ error: "No body received", raw: req.body });
    }

    if (!body.image) {
      return res.status(400).json({ error: "Missing 'image' field", raw: body });
    }

    // Defensive check: if the image field contains HTML (common cause of parse errors)
    if (typeof body.image === "string" && body.image.trim().startsWith("<")) {
      console.log("Image field contains HTML or unexpected content.");
      return res.status(400).json({ error: "Invalid image content (HTML received)" });
    }

    // If the client sent a short test string, return a clear validation error
    if (body.image === "test" || (typeof body.image === "string" && body.image.length < 50)) {
      return res.status(400).json({ error: "Invalid base64 image" });
    }

    // Validate base64-ish image before attempting heavy processing
    if (!isLikelyBase64Image(body.image)) {
      return res.status(400).json({ error: "Invalid base64 image" });
    }

    // At this point the request looks valid. Insert your model / processing logic here.
    // Example placeholder: pretend we call an external model and return a result.
    // Wrap external calls in try/catch to avoid unhandled rejections.
    try {
      // Example:
      // const result = await callYourModelOrService(body.image);
      // return res.status(200).json({ result });

      // Placeholder response while model integration is present:
      return res.status(200).json({ error: "Model integration not implemented in this placeholder" });
    } catch (innerErr) {
      console.log("Error during model call:", innerErr);
      // Return a safe JSON error (avoid returning raw HTML)
      return res.status(502).json({ error: "Upstream service error", details: String(innerErr.message || innerErr) });
    }
  } catch (err) {
    // Catch-all: log and return JSON error
    console.error("Unhandled handler error:", err);
    // Ensure we always return JSON (avoid sending HTML)
    return res.status(500).json({ error: String(err.message || err) });
  }
}
