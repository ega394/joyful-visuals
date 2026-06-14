/**
 * api/ai-newsroom.js — Prokopim v1.5: AI Newsroom
 *
 * ENDPOINT:
 *   POST /api/ai-newsroom?action=generate   → Generate draf berita dari catatan lapangan
 *   POST /api/ai-newsroom?action=save        → Simpan/update draft
 *   POST /api/ai-newsroom?action=submit      → Kirim ke Kasubbag untuk review
 *   POST /api/ai-newsroom?action=approve     → Kasubbag setujui & rilis
 *   POST /api/ai-newsroom?action=revise      → Kasubbag kembalikan untuk revisi
 *   GET  /api/ai-newsroom?action=list        → Ambil daftar draft (filter by status/author)
 *
 * ENV VARS DIBUTUHKAN:
 *   GEMINI_API_KEY       → Google AI Studio API key
 *   SUPABASE_URL         → Supabase project URL
 *   SUPABASE_KEY         → Supabase anon/service key
 *   FONNTE_TOKEN         → WhatsApp via Fonnte
 *   API_SECRET           → Secret untuk validasi request internal
 */

const SUPA_URL   = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPA_KEY   = process.env.SUPABASE_KEY  || process.env.VITE_SUPABASE_ANON_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const FONNTE     = process.env.FONNTE_TOKEN;

// ── Helper Supabase ──────────────────────────────────────────
const H = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Prefer":        "return=representation",
});

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) { const e = await r.text(); throw new Error(`Supabase GET error: ${e}`); }
  return r.json();
}

async function sbPost(table, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST", headers: H(), body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`Supabase POST error: ${e}`); }
  return r.json();
}

async function sbPatch(table, filter, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: H(), body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`Supabase PATCH error: ${e}`); }
  return r.json();
}

// ── WhatsApp Notifikasi ──────────────────────────────────────
async function sendWA(to, message) {
  if (!FONNTE || !to) return { ok: false, reason: "no_token_or_target" };
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: to, message, countryCode: "62" }),
    });
    return { ok: r.ok };
  } catch (err) {
    console.error("[WA]", err.message);
    return { ok: false };
  }
}

// ── CORE: Generate Berita dengan Gemini AI ───────────────────
/**
 * generateNewsWithGemini
 *
 * Mengirim catatan lapangan ke Gemini 1.5 Flash untuk dijadikan:
 * 1. Teks berita format Straight News (siap publish di web/portal)
 * 2. Caption Instagram (singkat, informatif, dengan hashtag)
 *
 * PANDUAN PROMPT ENGINEERING:
 * - Gaya: formal, netral, jurnalistik (bukan promosi)
 * - Format berita: 5W+1H, lead paragraph kuat
 * - Caption IG: max 150 kata + 5-7 hashtag lokal Tarakan
 * - Hindari opini, fokus pada fakta dari catatan
 */
// Dispatcher provider AI: Gemini (default), Groq, atau OpenRouter.
// Semuanya menghasilkan { berita, captionIg }.
async function generateNews({ provider, rawNotes, agendaName, agendaDate, lokasi }) {
  const p = String(provider || process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (p === "groq")       return generateNewsWithGroq({ rawNotes, agendaName, agendaDate, lokasi });
  if (p === "openrouter") return generateNewsWithOpenRouter({ rawNotes, agendaName, agendaDate, lokasi });
  return generateNewsWithGemini({ rawNotes, agendaName, agendaDate, lokasi });
}

// Provider: OpenRouter (gratis dengan kuota terpisah, dukung PDF).
async function generateNewsWithOpenRouter({ rawNotes, agendaName, agendaDate, lokasi }) {
  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) throw new Error("OPENROUTER_API_KEY belum diset di Vercel.");
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";

  const prompt = buildNewsPrompt({ rawNotes, agendaName, agendaDate, lokasi });
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + orKey,
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://prokopim.tarakankota.go.id",
      "X-Title": "Prokopim Hibot",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7, max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("OpenRouter tidak menghasilkan output");
  try {
    const clean = String(rawText).replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.berita || !parsed.caption_ig) throw new Error("Format output OpenRouter tidak sesuai");
    return { berita: parsed.berita, captionIg: parsed.caption_ig };
  } catch (e) {
    throw new Error("Gagal mem-parse output OpenRouter: " + e.message);
  }
}

// Helper umum: bangun prompt yang dipakai kedua provider.
function buildNewsPrompt({ rawNotes, agendaName, agendaDate, lokasi }) {
  const dateContext = agendaDate
    ? new Date(agendaDate + "T00:00:00+08:00").toLocaleDateString("id-ID", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        timeZone: "Asia/Makassar",
      })
    : "tanggal tidak diketahui";
  return `
Kamu adalah jurnalis profesional Humas Pemerintah Kota Tarakan, Kalimantan Utara.
Tugasmu: Ubah catatan lapangan berikut menjadi berita dan caption Instagram.

DATA KEGIATAN:
- Nama Acara  : ${agendaName}
- Tanggal     : ${dateContext} (WITA)
- Lokasi      : ${lokasi || "Kota Tarakan"}
- Catatan Lapangan:
---
${rawNotes}
---

INSTRUKSI:
Buatkan OUTPUT dalam format JSON dengan 2 key berikut (tanpa markdown, hanya JSON murni):

{
  "berita": "<teks berita format Straight News, min 3 paragraf, max 500 kata. Gunakan gaya bahasa formal dan netral. Lead paragraph harus menjawab 5W+1H. Sertakan nama lengkap Wali Kota dr. H. Khairul, M.Kes jika relevan. Akhiri dengan kalimat penutup yang mencerminkan visi Kota Tarakan>",
  "caption_ig": "<caption Instagram max 150 kata, awali dengan emoji yang relevan, informatif, sertakan 5-7 hashtag: #KotaTarakan #TarakanHibot #ProkopimTarakan + hashtag relevan dengan topik kegiatan>"
}

PENTING: Hanya balas dengan JSON. Tidak ada teks lain di luar JSON.`;
}

// Provider: Groq (OpenAI-compatible). Gratis dengan limit ramah.
async function generateNewsWithGroq({ rawNotes, agendaName, agendaDate, lokasi }) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY belum diset di Vercel.");
  const model = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";

  const prompt = buildNewsPrompt({ rawNotes, agendaName, agendaDate, lokasi });
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + groqKey },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7, max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("Groq tidak menghasilkan output");
  try {
    const clean = String(rawText).replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.berita || !parsed.caption_ig) throw new Error("Format output Groq tidak sesuai");
    return { berita: parsed.berita, captionIg: parsed.caption_ig };
  } catch (e) {
    throw new Error("Gagal mem-parse output Groq: " + e.message);
  }
}

async function generateNewsWithGemini({ rawNotes, agendaName, agendaDate, lokasi }) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY tidak tersedia");

  // Format tanggal WITA untuk konteks AI
  const dateContext = agendaDate
    ? new Date(agendaDate + "T00:00:00+08:00")
        .toLocaleDateString("id-ID", {
          weekday: "long", year: "numeric",
          month: "long", day: "numeric",
          timeZone: "Asia/Makassar",
        })
    : "tanggal tidak diketahui";

  const prompt = `
Kamu adalah jurnalis profesional Humas Pemerintah Kota Tarakan, Kalimantan Utara.
Tugasmu: Ubah catatan lapangan berikut menjadi berita dan caption Instagram.

DATA KEGIATAN:
- Nama Acara  : ${agendaName}
- Tanggal     : ${dateContext} (WITA)
- Lokasi      : ${lokasi || "Kota Tarakan"}
- Catatan Lapangan:
---
${rawNotes}
---

INSTRUKSI:
Buatkan OUTPUT dalam format JSON dengan 2 key berikut (tanpa markdown, hanya JSON murni):

{
  "berita": "<teks berita format Straight News, min 3 paragraf, max 500 kata. Gunakan gaya bahasa formal dan netral. Lead paragraph harus menjawab 5W+1H. Sertakan nama lengkap Wali Kota dr. H. Khairul, M.Kes jika relevan. Akhiri dengan kalimat penutup yang mencerminkan visi Kota Tarakan>",
  "caption_ig": "<caption Instagram max 150 kata, awali dengan emoji yang relevan, informatif, sertakan 5-7 hashtag: #KotaTarakan #TarakanHibot #ProkopimTarakan + hashtag relevan dengan topik kegiatan>"
}

PENTING: Hanya balas dengan JSON. Tidak ada teks lain di luar JSON.
`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.7,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini tidak menghasilkan output");

  // Parse JSON dari response Gemini
  try {
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.berita || !parsed.caption_ig) {
      throw new Error("Format output Gemini tidak sesuai");
    }
    return { berita: parsed.berita, captionIg: parsed.caption_ig };
  } catch {
    // Fallback: coba extract manual jika JSON corrupt
    console.warn("[AI] JSON parse gagal, coba extract manual");
    const beritaMatch = rawText.match(/"berita"\s*:\s*"([\s\S]*?)(?=",\s*"caption_ig")/);
    const captionMatch = rawText.match(/"caption_ig"\s*:\s*"([\s\S]*?)(?="\s*})/);
    if (beritaMatch && captionMatch) {
      return {
        berita:    beritaMatch[1].replace(/\\n/g, "\n"),
        captionIg: captionMatch[1].replace(/\\n/g, "\n"),
      };
    }
    throw new Error("Gagal memproses output AI. Coba lagi.");
  }
}

// ── ACTIONS ──────────────────────────────────────────────────

// ACTION: generate — kirim catatan ke AI, simpan hasil ke DB
async function actionGenerate(body) {
  const { agendaId, agendaName, agendaDate, lokasi, rawNotes, authorUsername } = body;
  if (!agendaId || !rawNotes || !authorUsername) {
    throw new Error("agendaId, rawNotes, dan authorUsername wajib diisi");
  }

  // Tandai status 'generating' dulu di DB
  const existing = await sbGet(
    `news_drafts?agenda_id=eq.${agendaId}&author_username=eq.${authorUsername}&order=created_at.desc&limit=1`
  );

  let draftId;
  if (existing.length > 0) {
    // Update existing draft
    draftId = existing[0].id;
    await sbPatch("news_drafts", `id=eq.${draftId}`, {
      raw_notes: rawNotes, news_status: "generating", updated_at: new Date().toISOString(),
    });
  } else {
    // Buat draft baru
    const created = await sbPost("news_drafts", {
      agenda_id: agendaId, agenda_name: agendaName || "",
      agenda_date: agendaDate || new Date().toISOString().slice(0, 10),
      raw_notes: rawNotes, news_status: "generating",
      author_username: authorUsername,
    });
    draftId = created[0].id;
  }

  // Generate dengan AI (provider bisa dipilih dari klien: gemini | groq)
  const { berita, captionIg } = await generateNews({
    provider: body.provider, rawNotes, agendaName, agendaDate, lokasi,
  });

  // Simpan hasil
  await sbPatch("news_drafts", `id=eq.${draftId}`, {
    ai_draft: berita, ig_caption: captionIg,
    news_status: "draft", updated_at: new Date().toISOString(),
  });

  return {
    ok: true, draftId,
    aiDraft: berita, igCaption: captionIg,
    message: "Draf berita berhasil digenerate ✓",
  };
}

// ACTION: submit — kirim ke Kasubbag Komdokpim
async function actionSubmit(body) {
  const { draftId, authorUsername } = body;
  if (!draftId) throw new Error("draftId wajib");

  await sbPatch("news_drafts", `id=eq.${draftId}`, {
    news_status: "pending_review",
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Ambil semua Kasubbag Komdokpim untuk kirim WA
  const editors = await sbGet(
    `users?role=eq.kasubbag_komdokpim&select=nama,noWA`
  );
  const draft = await sbGet(`news_drafts?id=eq.${draftId}&select=agenda_name`);
  const agendaName = draft[0]?.agenda_name || "Kegiatan";

  for (const editor of editors.filter(u => u.noWA)) {
    await sendWA(
      editor.noWA,
      `📰 *Draft Berita Menunggu Review*\n\n` +
      `Kegiatan: *${agendaName}*\n` +
      `Dikirim oleh: ${authorUsername}\n\n` +
      `Silakan buka aplikasi Prokopim → menu AI Newsroom untuk mereview dan menyetujui draft berita ini.\n\n` +
      `_Prokopim Kota Tarakan_`
    );
  }

  return { ok: true, message: "Draft dikirim ke Kasubbag Komdokpim ✓" };
}

// ACTION: approve — Kasubbag setujui draft
async function actionApprove(body) {
  const { draftId, editorUsername, finalNews, finalCaption } = body;
  if (!draftId || !editorUsername) throw new Error("draftId dan editorUsername wajib");

  await sbPatch("news_drafts", `id=eq.${draftId}`, {
    news_status: "approved",
    editor_username: editorUsername,
    final_news: finalNews || null,
    final_caption: finalCaption || null,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { ok: true, message: "Berita disetujui & siap rilis ✓" };
}

// ACTION: revise — Kasubbag kembalikan untuk revisi
async function actionRevise(body) {
  const { draftId, editorUsername, revisionNote } = body;
  if (!draftId || !revisionNote) throw new Error("draftId dan revisionNote wajib");

  const draft = await sbGet(`news_drafts?id=eq.${draftId}&select=author_username,agenda_name`);
  await sbPatch("news_drafts", `id=eq.${draftId}`, {
    news_status: "revision",
    editor_username: editorUsername,
    revision_note: revisionNote,
    updated_at: new Date().toISOString(),
  });

  // Notif WA ke author
  if (draft[0]?.author_username) {
    const author = await sbGet(
      `users?username=eq.${draft[0].author_username}&select=noWA`
    );
    if (author[0]?.noWA) {
      await sendWA(
        author[0].noWA,
        `✏️ *Draft Berita Perlu Revisi*\n\n` +
        `Kegiatan: *${draft[0].agenda_name}*\n` +
        `Catatan Kasubbag: ${revisionNote}\n\n` +
        `Silakan buka aplikasi Prokopim untuk merevisi draft.\n_Prokopim Kota Tarakan_`
      );
    }
  }

  return { ok: true, message: "Draft dikembalikan untuk revisi ✓" };
}

// ACTION: list — ambil daftar draft
async function actionList(query) {
  const { status, author, limit = 20, offset = 0 } = query;
  let filter = `order=updated_at.desc&limit=${limit}&offset=${offset}`;
  if (status) filter = `news_status=eq.${status}&${filter}`;
  if (author) filter = `author_username=eq.${author}&${filter}`;
  return sbGet(`news_drafts?${filter}`);
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action;

  try {
    let result;
    if (req.method === "GET") {
      if (action === "list") result = await actionList(req.query);
      else return res.status(400).json({ error: "Action tidak dikenal" });
    } else if (req.method === "POST") {
      const body = req.body;
      if      (action === "generate") result = await actionGenerate(body);
      else if (action === "save")     result = await sbPatch("news_drafts", `id=eq.${body.draftId}`, { raw_notes: body.rawNotes, ai_draft: body.aiDraft, updated_at: new Date().toISOString() });
      else if (action === "submit")   result = await actionSubmit(body);
      else if (action === "approve")  result = await actionApprove(body);
      else if (action === "revise")   result = await actionRevise(body);
      else return res.status(400).json({ error: "Action tidak dikenal" });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("[AI-NEWSROOM]", err.message);
    return res.status(500).json({ error: err.message });
  }
}