// api/analyze.js

import { Puter } from 'puter-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing imageUrl' });
    }

    const puter = new Puter({ apiKey: process.env.PUTER_API_KEY });

    const prompt = `
You are a clothing recognition AI. Analyze the image and return ONLY valid JSON with:

{
  "clothingName": "",
  "color": "",
  "brand": "",
  "category": "",
  "subtype": "",
  "keywords": []
}

Be extremely accurate. No extra text.
`;

    const response = await puter.ai.chat(prompt, {
      images: [imageUrl],
      model: "google/gemma-3-12b-it"
    });

    // Extract JSON safely
    const text = response.output_text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const jsonString = text.substring(jsonStart, jsonEnd + 1);

    const data = JSON.parse(jsonString);

    return res.status(200).json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
