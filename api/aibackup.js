import https from "https";

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: { error: raw } }); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk.toString(); });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (e) { resolve({}); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY belum diset di Vercel Environment Variables."
    });
  }

  const body = await readBody(req);
  const messages = body.messages || [];
  if (!messages.length) {
    return res.status(400).json({ error: "Request tidak valid." });
  }

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

  if (!parts.length) {
    return res.status(400).json({ error: "Tidak ada konten untuk diproses." });
  }

  try {
    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + apiKey;

    const result = await httpsPost(geminiUrl, {
      contents: [{ parts: parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
    });

    if (result.status !== 200) {
      const msg = result.body && result.body.error && result.body.error.message
        ? String(result.body.error.message)
        : "Gemini error " + result.status;
      return res.status(result.status).json({ error: msg });
    }

    const text =
      result.body &&
      result.body.candidates &&
      result.body.candidates[0] &&
      result.body.candidates[0].content &&
      result.body.candidates[0].content.parts &&
      result.body.candidates[0].content.parts[0] &&
      result.body.candidates[0].content.parts[0].text
        ? String(result.body.candidates[0].content.parts[0].text)
        : "";

    if (!text) {
      return res.status(500).json({ error: "Gemini tidak menghasilkan teks. Coba foto/PDF lebih jelas." });
    }

    return res.status(200).json({ content: [{ type: "text", text: text }] });

  } catch (err) {
    return res.status(500).json({ error: "Gagal menghubungi Gemini: " + String(err.message || err) });
  }
};
