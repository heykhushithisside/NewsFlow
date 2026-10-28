export default async function handler(req, res) {
  // This must match the method your frontend uses ("POST")
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, hfKey } = req.body || {};

    if (!text || !hfKey) {
      return res.status(400).json({ error: 'Missing text or HuggingFace token.' });
    }

    const HF_MODEL = "mrm8488/bert-tiny-finetuned-fake-news-detection";
    const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

    const response = await fetch(HF_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText || "External API error" };
    }

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}