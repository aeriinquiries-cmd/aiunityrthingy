export const runtime = "nodejs";

import Busboy from "busboy";
import { put } from "@vercel/blob";

async function log(msg) {
  try {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "```json\n" + msg + "\n```" }),
    });
  } catch (e) {}
}

export default async function handler(req, res) {
  await log("Upload request received");

  if (req.method !== "POST") {
    await log("Invalid method");
    return res.status(405).json({ error: "POST only" });
  }

  const busboy = Busboy({ headers: req.headers });

  let fileBuffer = Buffer.from([]);

  return new Promise((resolve, reject) => {
    busboy.on("file", (fieldname, file) => {
      file.on("data", (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });

      file.on("end", () => {
        log("File received, size: " + fileBuffer.length);
      });
    });

    busboy.on("finish", async () => {
      try {
        if (fileBuffer.length < 500) {
          await log("ERROR: File too small");
          return resolve(res.status(400).json({ error: "File too small" }));
        }

        const blob = await put(`thready-${Date.now()}.jpg`, fileBuffer, {
          access: "public",
        });

        await log("Blob uploaded: " + blob.url);

        return resolve(res.status(200).json({ url: blob.url }));
      } catch (err) {
        await log("FATAL UPLOAD ERROR: " + err.message);
        return resolve(res.status(500).json({ error: err.message }));
      }
    });

    req.pipe(busboy);
  });
}
