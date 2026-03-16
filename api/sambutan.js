// api/sambutan.js
// Konversi DOCX → PDF naskah sambutan resmi
// Stack: mammoth (ekstraksi) + pdf-lib (generate PDF)
// 100% serverless-compatible — no binary dependencies

"use strict";

const mammoth   = require("mammoth");
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");

// ────────────────────────────────────────────────────────────────────────────
// LAYOUT — ukuran A4 dalam pt (1pt = 1/72 inch)
// ────────────────────────────────────────────────────────────────────────────
const A4W = 595.28;
const A4H = 841.89;

// Margin formal (menyesuaikan standar surat dinas Indonesia)
const ML  = 85;                  // kiri  ~3cm
const MR  = 57;                  // kanan ~2cm
const MT  = 72;                  // atas  ~2.54cm
const MB  = 56;                  // bawah ~2cm
const TW  = A4W - ML - MR;      // lebar area teks

// Tipografi
const SZ_TITLE  = 14;
const SZ_META   = 10;
const SZ_BODY   = 12;
const LH_BODY   = SZ_BODY * 1.6;   // leading 1.6 → nyaman dibaca
const GAP_PARA  = SZ_BODY * 0.8;   // jarak antar paragraf
const INDENT    = SZ_BODY * 2.5;   // indentasi alinea ~30pt

// Warna
const C_BLACK = rgb(0.08, 0.08, 0.08);
const C_NAVY  = rgb(0.04, 0.08, 0.16);
const C_GRAY  = rgb(0.40, 0.40, 0.40);
const C_LGRAY = rgb(0.70, 0.70, 0.70);

// ────────────────────────────────────────────────────────────────────────────
// HELPER: ukur lebar teks (guard karakter non-latin)
// ────────────────────────────────────────────────────────────────────────────
function measureText(font, text, size) {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    // Estimasi kasar untuk karakter diluar cp1252
    return text.length * size * 0.55;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: pecah teks menjadi baris sesuai maxWidth
// ────────────────────────────────────────────────────────────────────────────
function wrapLine(font, text, size, maxWidth) {
  if (!text.trim()) return [""];
  const words  = text.split(/\s+/).filter(Boolean);
  const lines  = [];
  let current  = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(font, candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// ────────────────────────────────────────────────────────────────────────────
// STATE halaman — dibawa antar fungsi
// ────────────────────────────────────────────────────────────────────────────
class PageState {
  constructor(pdfDoc, fontR, fontB, fontI) {
    this.pdfDoc   = pdfDoc;
    this.fontR    = fontR;
    this.fontB    = fontB;
    this.fontI    = fontI;
    this.pageNum  = 0;
    this.page     = null;
    this.cursorY  = 0;
    this._newPage();
  }

  _newPage() {
    this.page    = this.pdfDoc.addPage([A4W, A4H]);
    this.pageNum += 1;
    this.cursorY  = A4H - MT;
  }

  needBreak(height) {
    return this.cursorY - height < MB;
  }

  breakPage() {
    // Nomor halaman di halaman lama
    this._stampPageNum();
    this._newPage();
  }

  _stampPageNum() {
    if (this.pageNum < 2) return;          // hal. 1 di-stamp terpisah setelah selesai
    const txt = `— ${this.pageNum} —`;
    const w   = measureText(this.fontR, txt, 9);
    this.page.drawText(txt, {
      x: (A4W - w) / 2,
      y: MB * 0.45,
      size: 9,
      font: this.fontR,
      color: C_LGRAY,
    });
  }

  stampAllPageNums(totalPages) {
    // Stamp halaman 1 juga setelah semua halaman diketahui
    const pages = this.pdfDoc.getPages();
    pages.forEach((pg, i) => {
      const txt = `— ${i + 1} / ${totalPages} —`;
      const w   = measureText(this.fontR, txt, 9);
      pg.drawText(txt, {
        x: (A4W - w) / 2,
        y: MB * 0.45,
        size: 9,
        font: this.fontR,
        color: C_LGRAY,
      });
    });
  }

  // ── Tulis satu baris teks ──────────────────────────────────────────────
  drawText(text, { font, size, color = C_BLACK, x = ML, extraLineHeight = 0 } = {}) {
    const lh = (size || SZ_BODY) * 1.6 + extraLineHeight;
    if (this.needBreak(size || SZ_BODY)) {
      this._stampPageNum();
      this._newPage();
    }
    this.page.drawText(text, {
      x,
      y: this.cursorY - (size || SZ_BODY),
      size: size || SZ_BODY,
      font: font || this.fontR,
      color,
    });
    this.cursorY -= lh;
  }

  // ── Maju cursor tanpa teks (spasi) ────────────────────────────────────
  skip(pt) {
    this.cursorY -= pt;
  }

  // ── Garis horizontal ──────────────────────────────────────────────────
  drawHRule(thickness = 0.6, color = C_LGRAY) {
    this.page.drawLine({
      start: { x: ML,      y: this.cursorY },
      end:   { x: A4W - MR, y: this.cursorY },
      thickness,
      color,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PARSE HTML dari mammoth → array of paragraph objects
// ────────────────────────────────────────────────────────────────────────────
function parseHtml(html, fallback) {
  const paras = [];
  const re    = /<(p|h[1-6]|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let   m;

  while ((m = re.exec(html)) !== null) {
    const tag     = m[1].toLowerCase();
    const content = m[2]; // attributes
    const inner   = m[3]
      .replace(/<[^>]+>/g, "")           // strip inline tags
      .replace(/&amp;/g,  "&")
      .replace(/&lt;/g,   "<")
      .replace(/&gt;/g,   ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g,  "'")
      .replace(/\s+/g,    " ")
      .trim();

    if (!inner) continue;

    const isHeading = /^h[1-6]$/.test(tag);
    const isBold    = /<strong|<b /i.test(m[0]);
    const isCenter  = /align="center"|text-align:\s*center/i.test(content);

    paras.push({ text: inner, heading: isHeading, bold: isBold || isHeading, center: isCenter || isHeading });
  }

  // Fallback: pisah per baris jika parsing HTML gagal
  if (paras.length === 0) {
    return fallback
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(text => ({ text, heading: false, bold: false, center: false }));
  }

  return paras;
}

// ────────────────────────────────────────────────────────────────────────────
// BUILD PDF
// ────────────────────────────────────────────────────────────────────────────
async function buildPDF({ paragraphs, namaAcara, tanggalFmt, penyelenggara, lokasi }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(namaAcara || "Naskah Sambutan");
  pdfDoc.setAuthor("Bagian Protokol dan Komunikasi Pimpinan – Pemkot Tarakan");
  pdfDoc.setCreator("Sistem Jadwal Pimpinan Prokopim Tarakan");

  const fontR = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontB = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontI = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const state = new PageState(pdfDoc, fontR, fontB, fontI);

  // ── HEADER: garis tebal ───────────────────────────────────────────────
  state.page.drawLine({
    start: { x: ML,      y: state.cursorY + 4 },
    end:   { x: A4W - MR, y: state.cursorY + 4 },
    thickness: 2.5,
    color: C_NAVY,
  });
  state.skip(18);

  // ── Label "NASKAH SAMBUTAN" ───────────────────────────────────────────
  const labelMain = "NASKAH SAMBUTAN";
  const labelW    = measureText(fontB, labelMain, SZ_TITLE);
  state.drawText(labelMain, {
    font: fontB,
    size: SZ_TITLE,
    color: C_NAVY,
    x: (A4W - labelW) / 2,
  });
  state.skip(4);

  // ── Nama kegiatan ─────────────────────────────────────────────────────
  if (namaAcara) {
    const lines = wrapLine(fontB, namaAcara.toUpperCase(), SZ_TITLE - 1, TW);
    for (const line of lines) {
      const lw = measureText(fontB, line, SZ_TITLE - 1);
      state.drawText(line, {
        font: fontB,
        size: SZ_TITLE - 1,
        color: C_BLACK,
        x: (A4W - lw) / 2,
      });
    }
  }
  state.skip(8);

  // ── Meta info ─────────────────────────────────────────────────────────
  const metas = [
    tanggalFmt    ? `Tanggal         : ${tanggalFmt}`    : null,
    penyelenggara ? `Penyelenggara   : ${penyelenggara}` : null,
    lokasi        ? `Tempat          : ${lokasi}`        : null,
  ].filter(Boolean);

  for (const meta of metas) {
    const mw = measureText(fontI, meta, SZ_META);
    state.drawText(meta, {
      font:  fontI,
      size:  SZ_META,
      color: C_GRAY,
      x:     (A4W - mw) / 2,
    });
    state.cursorY += (SZ_META * 1.6) - (SZ_META * 1.25); // tighter spacing untuk meta
  }
  state.skip(14);

  // ── Garis pemisah tipis ───────────────────────────────────────────────
  state.drawHRule(0.75, C_LGRAY);
  state.skip(20);

  // ── ISI NASKAH ────────────────────────────────────────────────────────
  for (const para of paragraphs) {
    const { text, heading, bold, center } = para;

    if (!text.trim()) {
      state.skip(GAP_PARA * 0.6);
      continue;
    }

    const font     = bold ? fontB : fontR;
    const size     = heading ? SZ_BODY + 1 : SZ_BODY;
    const maxWidth = heading || center ? TW : TW - INDENT;

    // Paragraf heading — centered
    if (heading) {
      state.skip(GAP_PARA * 0.5);
      const lines = wrapLine(font, text, size, TW);
      for (const line of lines) {
        const lw = measureText(font, line, size);
        state.drawText(line, { font, size, color: C_BLACK, x: (A4W - lw) / 2 });
      }
      state.skip(GAP_PARA * 0.5);
      continue;
    }

    // Paragraf biasa — indentasi baris pertama
    const words   = text.split(/\s+/).filter(Boolean);
    let   isFirst = true;
    let   line    = "";

    const flushLine = (last = false) => {
      if (!line) return;
      const xPos = isFirst && !center
        ? ML + INDENT
        : center
          ? (A4W - measureText(font, line, size)) / 2
          : ML;
      const availW = isFirst ? TW - INDENT : TW;

      // Justified (semua baris kecuali terakhir)
      if (!center && !last && measureText(font, line, size) > availW * 0.6) {
        drawJustified(state, font, line, size, xPos, availW - (isFirst ? 0 : 0), isFirst);
      } else {
        state.drawText(line, { font, size, color: C_BLACK, x: xPos });
      }
      line    = "";
      isFirst = false;
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const avail     = (isFirst && !center) ? TW - INDENT : TW;
      if (measureText(font, candidate, size) > avail && line) {
        flushLine(false);
      }
      line = line ? `${line} ${word}` : word;
    }
    flushLine(true); // baris terakhir — rata kiri

    state.skip(GAP_PARA);
  }

  // ── Footer: garis bawah tipis ─────────────────────────────────────────
  state.skip(10);
  state.drawHRule(0.5);
  state.skip(8);

  const footerTxt = "Dokumen disiapkan oleh Bagian Protokol dan Komunikasi Pimpinan – Pemerintah Kota Tarakan";
  const fw = measureText(fontI, footerTxt, 8);
  state.page.drawText(footerTxt, {
    x: (A4W - fw) / 2,
    y: state.cursorY,
    size: 8,
    font: fontI,
    color: C_LGRAY,
  });

  // Stamp nomor semua halaman
  const totalPages = pdfDoc.getPageCount();
  state.stampAllPageNums(totalPages);

  return await pdfDoc.save();
}

// ── Helper: teks justified (tambah spasi antar kata) ────────────────────
function drawJustified(state, font, line, size, x0, availW, isFirstLine) {
  const words = line.split(" ");
  if (words.length <= 1) {
    state.drawText(line, { font, size, color: C_BLACK, x: x0 });
    return;
  }
  const totalWordW = words.reduce((s, w) => s + measureText(font, w, size), 0);
  const extraSpace = (availW - totalWordW) / (words.length - 1);
  // Jangan terlalu meregang (maks 4pt tambahan per spasi)
  if (extraSpace > 6 || extraSpace < 0) {
    state.drawText(line, { font, size, color: C_BLACK, x: x0 });
    return;
  }

  if (state.needBreak(size)) {
    state.page._stampPageNum?.();
    state._stampPageNum();
    state._newPage();
  }

  let curX = x0;
  for (let i = 0; i < words.length; i++) {
    state.page.drawText(words[i], {
      x: curX,
      y: state.cursorY - size,
      size,
      font,
      color: C_BLACK,
    });
    curX += measureText(font, words[i], size) + (i < words.length - 1 ? extraSpace + measureText(font, " ", size) : 0);
  }
  state.cursorY -= LH_BODY;
}

// ────────────────────────────────────────────────────────────────────────────
// FORMAT TANGGAL ke format Indonesia
// ────────────────────────────────────────────────────────────────────────────
function fmtTanggal(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// VERCEL HANDLER
// ────────────────────────────────────────────────────────────────────────────
const { rateLimit } = require("./_middleware");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Secret");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  // Rate limit — 8 konversi per menit per IP (operasi berat)
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const rl  = rateLimit(`sambutan:${ip}`, 8, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({ error: `Rate limit — coba lagi dalam ${retryAfter} detik` });
  }

  try {
    const {
      docxBase64,
      namaAcara     = "",
      tanggal       = "",
      penyelenggara = "",
      lokasi        = "",
    } = req.body || {};

    // ── Validasi input ──────────────────────────────────────────────────
    if (!docxBase64 || typeof docxBase64 !== "string") {
      return res.status(400).json({ error: "Field 'docxBase64' wajib diisi" });
    }

    let docxBuffer;
    try {
      docxBuffer = Buffer.from(docxBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Format base64 tidak valid" });
    }

    if (docxBuffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: "File terlalu besar — maks 5 MB" });
    }

    // Magic-byte check: DOCX adalah ZIP (50 4B 03 04)
    if (docxBuffer[0] !== 0x50 || docxBuffer[1] !== 0x4B) {
      return res.status(422).json({ error: "File bukan format DOCX yang valid" });
    }

    // ── Ekstrak teks ─────────────────────────────────────────────────────
    let rawText = "", htmlText = "";
    try {
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer: docxBuffer }),
        mammoth.convertToHtml({ buffer: docxBuffer }),
      ]);
      rawText  = textResult.value  || "";
      htmlText = htmlResult.value  || "";
      if (textResult.messages?.length) {
        console.warn("[sambutan] mammoth warnings:", textResult.messages.map(m => m.message).join("; "));
      }
    } catch (err) {
      return res.status(422).json({ error: "Gagal membaca DOCX: " + err.message });
    }

    if (!rawText.trim()) {
      return res.status(422).json({ error: "Dokumen kosong atau tidak mengandung teks" });
    }

    // ── Parse paragraf ────────────────────────────────────────────────────
    const paragraphs = parseHtml(htmlText, rawText);

    // ── Generate PDF ──────────────────────────────────────────────────────
    const pdfBytes = await buildPDF({
      paragraphs,
      namaAcara,
      tanggalFmt:   fmtTanggal(tanggal),
      penyelenggara,
      lokasi,
    });

    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // ── Buat nama file terurut ─────────────────────────────────────────────
    const datePfx = (tanggal || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const safeName = (namaAcara || "sambutan")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // strip diakritik
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 45);
    const fileName = `${datePfx}_sambutan_${safeName}`;   // e.g. 20260310_sambutan_hut_kota_tarakan

    return res.status(200).json({
      ok:          true,
      pdfBase64,
      fileName,                   // tanpa ekstensi; frontend append .pdf / .docx
      charCount:   rawText.length,
      paraCount:   paragraphs.length,
    });

  } catch (err) {
    console.error("[api/sambutan] Unhandled error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};

// Vercel: naikkan limit body ke 8MB untuk DOCX besar (default 4.5MB)
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};
