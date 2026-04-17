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

    const deepRes = await fetch("https://api.deepai.org/api/image-tagging", {
      method: "POST",
      headers: {
        "Api-Key": process.env.DEEPAI_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: `data:image/jpeg;base64,${base64}`
      })
    });

    const json = await deepRes.json();

    if (!deepRes.ok) {
      return res.status(502).json({
        error: "DeepAI error",
        details: json
      });
    }

    let label = "unknown";

    if (json.output && json.output.tags && json.output.tags.length > 0) {
      label = json.output.tags[0].tag;
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
