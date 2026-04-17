// Call the Fashion-CLIP model
const hfRes = await fetch(
  "https://api-inference.huggingface.co/models/patrickjohncyh/fashion-clip",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: base64
    })
  }
);

const hfJson = await hfRes.json();

// Extract label (model returns similarity scores)
let label = "unknown";

if (Array.isArray(hfJson) && hfJson.length > 0) {
  // The model returns an array of objects with labels + scores
  label = hfJson[0].label || "unknown";
}

return res.status(200).json({
  classification: {
    label
  }
});
