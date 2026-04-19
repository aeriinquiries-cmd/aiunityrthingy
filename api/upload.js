export const runtime = "nodejs";

import { put } from "@vercel/blob";

// Discord logging helper
async function log(msg) {
  try {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "```json\n" + msg + "\n```",
      }),
    });
  } catch (e) {}
}

export default async function handler(req) {
  try {
    await log("Upload request received");

    if (req.method !== "POST") {
      await log("Invalid method");
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
      });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file) {
      await log("No file found");
      return new Response(JSON.stringify({ error: "Missing file" }), {
        status: 400,
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    await log("File received, size: " + bytes.length);

    if (bytes.length < 500) {
      await log("ERROR: File too small");
      return new Response(
        JSON.stringify({ error: "File too small or corrupted" }),
        { status: 400 }
      );
    }

    const blob = await put(`thready-${Date.now()}.jpg`, bytes, {
      access: "public",
    });

    await log("Blob uploaded: " + blob.url);

    return new Response(JSON.stringify({ url: blob.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await log("FATAL UPLOAD ERROR: " + err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
