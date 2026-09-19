import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors({
  origin: ['https://urartuhi.com', 'https://www.urartuhi.com', 'http://localhost:3000', 'http://localhost:5173']
}));
app.use(express.json());
app.get('/', (req, res) => res.json({ name: 'Urartuhi Docent', status: 'live' }));
app.post('/api/narrate', async (req, res) => {
  const { imageUrl, pieceId, question } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY missing on Railway' });
  const systemPrompt = `You are Urartuhi, keeper of An Instant In Eternity. Ancient, poetic whisper docent. Piece: ${pieceId} - ${imageUrl}. If no question, narrate 2-3 sentences mystical. If question, answer only about THIS image.`;
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", temperature: 0.85, stream: true, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question || `Narrate ${pieceId}` }] })
    });
    if (!openaiRes.ok) { const err = await openaiRes.text(); return res.status(openaiRes.status).json({ error: err }); }
    res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive');
    for await (const chunk of openaiRes.body) { res.write(chunk); }
    res.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Backs the /avatar page's "Generate" button. Reuses the same
// OPENAI_API_KEY already required for /api/narrate. Wraps OpenAI's Images
// API (gpt-image-1); returns base64 PNG data the client renders directly.
app.post('/api/generate-avatar', async (req, res) => {
  const { prompt, style, referenceImage } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY missing on Railway' });
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // NOTE: referenceImage (a data URL from an optional upload) is accepted
  // but not yet forwarded to an image-edit/variation call -- gpt-image-1
  // generation-from-text is used for v1. TODO: wire referenceImage through
  // OpenAI's image edit endpoint for a true image-guided avatar.
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: `${prompt}${style ? ` (style: ${style})` : ''}`,
        size: "1024x1024",
        n: 1,
      }),
    });
    if (!openaiRes.ok) { const err = await openaiRes.text(); return res.status(openaiRes.status).json({ error: err }); }
    const data = await openaiRes.json();
    const image = data && data.data && data.data[0] && (data.data[0].b64_json || data.data[0].url);
    if (!image) return res.status(502).json({ error: 'No image returned from OpenAI' });
    res.json({ image });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Urartuhi docent live on ${port}`));
