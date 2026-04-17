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

    const puterRes = await fetch("https://api.puter.com/v2/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.4-nano",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Identify the clothing item in this image." },
              { type: "image", image: `data:image/jpeg;base64,${base64}` }
            ]
          }
        ]
      })
    });

    const text = await puterRes.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Invalid response from Puter",
        details: text
      });
    }

    const answer = json?.choices?.[0]?.message?.content?.[0]?.text || "unknown";

    return res.status(200).json({
      classification: { label: answer }
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
}
