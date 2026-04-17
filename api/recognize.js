export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  // quick sanity response
  return res.status(200).json({ ok: true, receivedHeaders: req.headers["content-type"] || null });
}
