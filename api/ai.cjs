const https = require("https");
const { guard } = require("./_middleware");

function httpsPost(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data, "utf8"),
        ...extraHeaders,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: { error: raw.slice(0, 400) } }); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(data, "utf8");
    req.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => { raw += c.toString(); });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  const g = guard(req, res, { requireSecret: false, maxPerMin: 10 });
  if (g) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY belum diset di Vercel." });

  const body = await readBody(req);
  const messages = body.messages || [];
  if (!messages.length) return res.status(400).json({ error: "Request tidak valid." });

  // Bangun parts untuk Gemini API
  const contentArr = Array.isArray(messages[0].content)
    ? messages[0].content
    : [{ type: "text", text: String(messages[0].content || "") }];

  const parts = [];
  for (const block of contentArr) {
    if (block.type === "text") {
      parts.push({ text: block.text });
    } else if ((block.type === "image" || block.type === "document") && block.source) {
      parts.push({ inline_data: { mime_type: block.source.media_type, data: block.source.data } });
    }
  }

  if (!parts.length) return res.status(400).json({ error: "Tidak ada konten untuk diproses." });

  try {
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const result = await httpsPost(url, {
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    });

    if (result.status !== 200) {
      const msg = result.body?.error?.message || ("Gemini error " + result.status);
      return res.status(result.status).json({ error: String(msg) });
    }

    const text = result.body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) return res.status(500).json({ error: "Gemini tidak menghasilkan teks. Coba foto lebih jelas." });

    return res.status(200).json({ content: [{ type: "text", text }] });

  } catch (err) {
    return res.status(500).json({ error: "Gagal menghubungi Gemini: " + String(err.message || err) });
  }
};
