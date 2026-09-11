/**
 * scripts/_markdown.mjs — pengurai markdown seadanya untuk keperluan cetak
 *
 * Sengaja tidak memakai pustaka luar: bentuk markdown di repositori ini kita
 * kendalikan sendiri, dan yang dibutuhkan hanya judul, tabel, daftar, kutipan,
 * paragraf, serta penekanan sebaris.
 *
 * Dipakai bersama oleh scripts/sop-pdf.mjs dan scripts/proposal-pdf.mjs supaya
 * keduanya tidak berbeda pendapat tentang cara membaca berkas yang sama.
 */

// ── Pengurai markdown ────────────────────────────────────────────
export const lolos = (s) => s
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Sebaris: **tebal**, *miring*, `kode`, dan <br> yang memang kita tulis sendiri.
export function sebaris(s) {
  return lolos(s)
    .replace(/&lt;br&gt;/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

const selDari = (baris) =>
  baris.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(s => s.trim());

const pemisahTabel = (b) => /^\|[\s:|-]+\|$/.test(b.trim());


export function keHTML(md, opsi = {}) {
  const baris = md.split("\n");
  const out = [];
  let i = 0;

  const tutupDaftar = (jenis) => { if (jenis) out.push(`</${jenis}>`); };
  let daftar = null;

  while (i < baris.length) {
    const b = baris[i];

    // Tabel: baris berawalan "|" yang diikuti baris pemisah.
    if (b.trim().startsWith("|") && pemisahTabel(baris[i + 1] || "")) {
      tutupDaftar(daftar); daftar = null;
      const kepala = selDari(b);
      const lebar  = kepala.length;
      i += 2;
      const isi = [];
      while (i < baris.length && baris[i].trim().startsWith("|")) {
        isi.push(selDari(baris[i])); i++;
      }
      // Tabel 7 kolom boleh dirender khusus oleh pemanggil — SOP memakainya
      // untuk diagram alir bercabang, dokumen lain membiarkannya tabel biasa.
      if (lebar === 7 && opsi.tabel7) { out.push(opsi.tabel7(isi)); continue; }

      const kelas = lebar === 2 ? "identitas" : "ringkas";
      out.push(`<table class="${kelas}"><thead><tr>` +
        kepala.map(h => `<th>${sebaris(h)}</th>`).join("") +
        `</tr></thead><tbody>` +
        isi.map(r => `<tr>` +
          r.map((c, k) => `<td class="k${k}">${sebaris(c)}</td>`).join("") +
        `</tr>`).join("") +
        `</tbody></table>`);
      continue;
    }

    // Blok berpagar ``` — dipertahankan apa adanya, termasuk perataan spasinya.
    // Diagram alur sederhana ditulis dengan spasi, jadi hurufnya harus tunggal
    // lebar dan barisnya tidak boleh dilipat.
    if (b.trim().startsWith("```")) {
      tutupDaftar(daftar); daftar = null;
      i++;
      const isi = [];
      while (i < baris.length && !baris[i].trim().startsWith("```")) { isi.push(baris[i]); i++; }
      i++;                                   // lewati pagar penutup
      out.push(`<pre class="blok">${lolos(isi.join("\n"))}</pre>`);
      continue;
    }

    // Kutipan (blok peringatan)
    if (b.startsWith(">")) {
      tutupDaftar(daftar); daftar = null;
      const isi = [];
      while (i < baris.length && baris[i].startsWith(">")) {
        isi.push(baris[i].replace(/^>\s?/, "")); i++;
      }
      out.push(`<div class="sorot">${keHTML(isi.join("\n"), opsi)}</div>`);
      continue;
    }

    const judul = b.match(/^(#{1,4})\s+(.*)$/);
    if (judul) {
      tutupDaftar(daftar); daftar = null;
      out.push(`<h${judul[1].length}>${sebaris(judul[2])}</h${judul[1].length}>`);
      i++; continue;
    }

    if (/^---+$/.test(b.trim())) {
      tutupDaftar(daftar); daftar = null;
      out.push(`<hr>`); i++; continue;
    }

    const bernomor = b.match(/^(\d+)\.\s+(.*)$/);
    const berbutir = b.match(/^[-*]\s+(.*)$/);
    if (bernomor || berbutir) {
      const jenis = bernomor ? "ol" : "ul";
      if (daftar !== jenis) { tutupDaftar(daftar); out.push(`<${jenis}>`); daftar = jenis; }
      // Baris lanjutan sebuah butir ditulis menjorok.
      let teks = (bernomor ? bernomor[2] : berbutir[1]);
      i++;
      while (i < baris.length && /^\s{2,}\S/.test(baris[i])) { teks += " " + baris[i].trim(); i++; }
      out.push(`<li>${sebaris(teks)}</li>`);
      continue;
    }

    if (!b.trim()) { tutupDaftar(daftar); daftar = null; i++; continue; }

    // Paragraf: kumpulkan sampai baris kosong.
    tutupDaftar(daftar); daftar = null;
    let par = b.trim(); i++;
    while (i < baris.length && baris[i].trim() && !baris[i].trim().startsWith("|")
           && !baris[i].startsWith(">") && !/^#{1,4}\s/.test(baris[i])
           && !/^---+$/.test(baris[i].trim()) && !/^(\d+\.|[-*])\s/.test(baris[i])) {
      par += " " + baris[i].trim(); i++;
    }
    out.push(`<p>${sebaris(par)}</p>`);
  }
  tutupDaftar(daftar);
  return out.join("\n");
}
