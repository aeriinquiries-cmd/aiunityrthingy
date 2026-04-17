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
      return res.status(400).json({ error: "Missing image field" });
    }

    // Remove data URL prefix if present
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    // CALL YOUR AI MODEL HERE
    // For now, return a fake label so Unity works
    return res.status(200).json({
      classification: {
        label: "tshirt"
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
