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
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Urartuhi docent live on ${port}`));
