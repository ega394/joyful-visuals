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

  const body = await readBody(req);
  const provider = String(body.provider || process.env.AI_PROVIDER || "gemini").toLowerCase();
  const messages = body.messages || [];
  if (!messages.length) return res.status(400).json({ error: "Request tidak valid." });

  const contentArr = Array.isArray(messages[0].content)
    ? messages[0].content
    : [{ type: "text", text: String(messages[0].content || "") }];

  // ── Provider: OpenRouter (gratis, kuota terpisah, dukung PDF via Gemini Flash) ──
  if (provider === "openrouter") {
    const orKey = process.env.OPENROUTER_API_KEY;
    if (!orKey) return res.status(500).json({ error: "OPENROUTER_API_KEY belum diset di Vercel." });
    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";

    const oaiContent = [];
    for (const block of contentArr) {
      if (block.type === "text") oaiContent.push({ type: "text", text: block.text });
      else if (block.type === "document" && block.source) {
        oaiContent.push({
          type: "file",
          file: {
            filename: "input.pdf",
            file_data: "data:" + (block.source.media_type || "application/pdf") + ";base64," + block.source.data,
          },
        });
      } else if (block.type === "image" && block.source) {
        const mt = block.source.media_type || "image/jpeg";
        oaiContent.push({
          type: "image_url",
          image_url: { url: "data:" + mt + ";base64," + block.source.data },
        });
      }
    }
    if (!oaiContent.length) return res.status(400).json({ error: "Tidak ada konten untuk diproses." });

    try {
      const result = await httpsPost("https://openrouter.ai/api/v1/chat/completions", {
        model,
        messages: [{ role: "user", content: oaiContent }],
        temperature: 0.1,
        max_tokens: 4096,
      }, {
        "Authorization": "Bearer " + orKey,
        "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://prokopim.tarakankota.go.id",
        "X-Title": "Prokopim Hibot",
      });

      if (result.status !== 200) {
        const msg = result.body?.error?.message || ("OpenRouter error " + result.status);
        return res.status(result.status).json({ error: String(msg) });
      }
      const text = result.body?.choices?.[0]?.message?.content || "";
      if (!text) return res.status(500).json({ error: "OpenRouter tidak menghasilkan teks." });
      return res.status(200).json({ content: [{ type: "text", text }] });
    } catch (err) {
      return res.status(500).json({ error: "Gagal menghubungi OpenRouter: " + String(err.message || err) });
    }
  }

  // ── Provider: Groq (OpenAI-compatible, gratis dengan limit ramah) ──
  // Catatan: model vision Groq HANYA menerima gambar — bukan PDF. Jika
  // input mengandung PDF/document, otomatis alihkan ke Gemini bila
  // tersedia, agar pemakai tidak terhambat saat upload undangan PDF.
  if (provider === "groq") {
    const hasDocument = contentArr.some(b =>
      b.type === "document" || (b.source && /^application\/pdf$/i.test(b.source.media_type || ""))
    );
    if (hasDocument) {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({
          error: "Groq belum mendukung PDF. Silakan upload sebagai gambar (JPG/PNG) atau pasang GEMINI_API_KEY di server.",
        });
      }
      // Lanjut ke jalur Gemini di bawah (provider fallback)
    } else {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) return res.status(500).json({ error: "GROQ_API_KEY belum diset di Vercel." });
      const model = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

      const oaiContent = [];
      for (const block of contentArr) {
        if (block.type === "text") oaiContent.push({ type: "text", text: block.text });
        else if (block.type === "image" && block.source) {
          const mt = block.source.media_type || "image/jpeg";
          oaiContent.push({
            type: "image_url",
            image_url: { url: "data:" + mt + ";base64," + block.source.data },
          });
        }
      }
      if (!oaiContent.length) return res.status(400).json({ error: "Tidak ada konten untuk diproses." });

    try {
      const result = await httpsPost("https://api.groq.com/openai/v1/chat/completions", {
        model,
        messages: [{ role: "user", content: oaiContent }],
        temperature: 0.1,
        max_tokens: 4096,
      }, { "Authorization": "Bearer " + groqKey });

      if (result.status !== 200) {
        const msg = result.body?.error?.message || ("Groq error " + result.status);
        return res.status(result.status).json({ error: String(msg) });
      }
      const text = result.body?.choices?.[0]?.message?.content || "";
      if (!text) return res.status(500).json({ error: "Groq tidak menghasilkan teks. Coba foto lebih jelas." });
      return res.status(200).json({ content: [{ type: "text", text }] });
    } catch (err) {
      return res.status(500).json({ error: "Gagal menghubungi Groq: " + String(err.message || err) });
    }
    }  // tutup else { (cabang non-PDF)
  }

  // ── Provider: Gemini (default, atau fallback otomatis untuk PDF di Groq) ──
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY belum diset di Vercel." });

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
