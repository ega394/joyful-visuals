/**
 * Daftar Hadir Prokopim — Google Apps Script Web App
 * ===================================================
 * Backend untuk halaman /daftarhadir. Data disimpan di Google Sheets,
 * foto selfie di Google Drive. TIDAK memakai Supabase.
 *
 * KENAPA BEGINI
 * Serverless Vercel proyek ini sudah penuh (12/12 pada paket Hobby), jadi
 * tidak bisa menambah endpoint API. Halaman /daftarhadir karena itu memanggil
 * Web App ini LANGSUNG dari browser tamu, tanpa perantara.
 *
 * KEPUTUSAN PRIVASI YANG PENTING
 * Web App ini TIDAK PERNAH mengembalikan data peserta (nama, no HP, foto).
 * Rekap hanya bisa dilihat dari Spreadsheet-nya langsung. Konsekuensinya:
 * seandainya TOKEN di bawah bocor, yang bisa dilakukan orang luar hanyalah
 * membuat acara sampah — bukan mengambil data pribadi tamu.
 *
 * ---------------------------------------------------------------------------
 * CARA PASANG (sekali saja, ±10 menit)
 *
 * 1. Login ke akun Google KHUSUS ABSEN.
 * 2. Buat Spreadsheet baru, beri nama mis. "Daftar Hadir Prokopim".
 * 3. Menu Extensions > Apps Script. Hapus isi Code.gs, tempel SELURUH berkas ini.
 * 4. Ganti nilai TOKEN di bawah dengan kata sandi acak buatan Anda sendiri.
 * 5. Simpan (ikon disket), lalu jalankan fungsi `setup` sekali:
 *    pilih "setup" pada daftar fungsi > Run > izinkan aksesnya saat diminta.
 *    Ini membuat tab "Acara", "Hadir", dan folder Drive untuk foto.
 * 6. Deploy > New deployment > pilih tipe "Web app":
 *      Execute as        : Me
 *      Who has access    : Anyone            <- WAJIB, tamu tidak punya akun Google
 *    Deploy > salin "Web app URL".
 * 7. Di Vercel, tambahkan dua Environment Variables lalu redeploy:
 *      VITE_ABSEN_URL   = <Web app URL tadi>
 *      VITE_ABSEN_TOKEN = <TOKEN yang Anda buat di langkah 4>
 *
 * CATATAN: setiap kali Anda mengubah skrip ini, deploy ULANG lewat
 * Deploy > Manage deployments > (pensil) > Version: New version > Deploy.
 * Kalau hanya "Save", perubahannya TIDAK aktif di URL yang sama.
 * ---------------------------------------------------------------------------
 */

// Ganti dengan kata sandi acak Anda sendiri. Hanya dipakai untuk membuat &
// menutup acara — bukan untuk membaca data peserta.
var TOKEN = "GANTI-DENGAN-KATA-SANDI-ACAK-ANDA";

var TAB_ACARA = "Acara";
var TAB_HADIR = "Hadir";
var NAMA_FOLDER = "Foto Daftar Hadir Prokopim";

// ── Setup awal ───────────────────────────────────────────────
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(TAB_ACARA)) {
    var a = ss.insertSheet(TAB_ACARA);
    a.appendRow([
      "kode", "judul", "subjudul", "tanggal", "lokasi",
      "field_aktif", "field_tambahan", "status", "dibuat_oleh", "dibuat_pada",
    ]);
    a.setFrozenRows(1);
  }

  if (!ss.getSheetByName(TAB_HADIR)) {
    var h = ss.insertSheet(TAB_HADIR);
    h.appendRow([
      "waktu_isi", "kode_acara", "judul_acara", "nama", "jabatan",
      "instansi", "no_hp", "foto", "tambahan",
    ]);
    h.setFrozenRows(1);
  }

  folderFoto();
  return "Setup selesai.";
}

function folderFoto() {
  var it = DriveApp.getFoldersByName(NAMA_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NAMA_FOLDER);
}

function sheet(nama) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nama);
}

function balas(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Samakan bentuk nomor: 0812…, +62812…, 62812… → 62812…
// Tanpa ini "0812" dan "+62812" dianggap dua orang berbeda dan pencegahan
// isian ganda jadi tidak ada gunanya.
function normalHP(v) {
  var d = String(v || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.indexOf("0") === 0) d = "62" + d.slice(1);
  else if (d.indexOf("62") !== 0) d = "62" + d;
  return d;
}

function kodeBaru() {
  var huruf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I,O,0,1 — mudah keliru
  var out = "";
  for (var i = 0; i < 6; i++) out += huruf.charAt(Math.floor(Math.random() * huruf.length));
  return out;
}

function cariAcara(kode) {
  var s = sheet(TAB_ACARA);
  if (!s) return null;
  var data = s.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase() === String(kode || "").toUpperCase()) {
      return {
        baris: i + 1,
        kode: data[i][0],
        judul: data[i][1],
        subjudul: data[i][2],
        tanggal: data[i][3],
        lokasi: data[i][4],
        fieldAktif: String(data[i][5] || "").split(",").filter(String),
        fieldTambahan: data[i][6] ? JSON.parse(data[i][6]) : [],
        status: data[i][7] || "buka",
      };
    }
  }
  return null;
}

// ── GET ──────────────────────────────────────────────────────
function doGet(e) {
  var q = (e && e.parameter) || {};
  try {
    // Dipanggil halaman publik: ambil konfigurasi satu acara.
    // Sengaja tidak memuat data peserta sama sekali.
    if (q.action === "acara") {
      var a = cariAcara(q.kode);
      if (!a) return balas({ ok: false, error: "Acara tidak ditemukan." });
      return balas({
        ok: true,
        acara: {
          kode: a.kode, judul: a.judul, subjudul: a.subjudul,
          tanggal: a.tanggal, lokasi: a.lokasi,
          fieldAktif: a.fieldAktif, fieldTambahan: a.fieldTambahan,
          status: a.status,
        },
      });
    }

    // Dipanggil dari dalam aplikasi (sudah login): daftar acara.
    // Hanya metadata + jumlah peserta, bukan datanya.
    if (q.action === "daftar_acara") {
      if (q.token !== TOKEN) return balas({ ok: false, error: "Token tidak sah." });
      var s = sheet(TAB_ACARA);
      var data = s ? s.getDataRange().getValues() : [];
      var h = sheet(TAB_HADIR);
      var hd = h ? h.getDataRange().getValues() : [];

      var jumlah = {};
      for (var j = 1; j < hd.length; j++) {
        var k = String(hd[j][1]);
        jumlah[k] = (jumlah[k] || 0) + 1;
      }

      var out = [];
      for (var i = 1; i < data.length; i++) {
        out.push({
          kode: data[i][0], judul: data[i][1], subjudul: data[i][2],
          tanggal: data[i][3], lokasi: data[i][4],
          fieldAktif: String(data[i][5] || "").split(",").filter(String),
          fieldTambahan: data[i][6] ? JSON.parse(data[i][6]) : [],
          status: data[i][7] || "buka",
          dibuatOleh: data[i][8], dibuatPada: data[i][9],
          jumlahHadir: jumlah[String(data[i][0])] || 0,
        });
      }
      out.reverse(); // terbaru di atas
      return balas({ ok: true, acara: out, sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() });
    }

    return balas({ ok: false, error: "Action tidak dikenal." });
  } catch (err) {
    return balas({ ok: false, error: String(err) });
  }
}

// ── POST ─────────────────────────────────────────────────────
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return balas({ ok: false, error: "Body tidak valid." }); }

  try {
    if (body.action === "buat_acara")  return buatAcara(body);
    if (body.action === "ubah_status") return ubahStatus(body);
    if (body.action === "daftar")      return simpanKehadiran(body);
    return balas({ ok: false, error: "Action tidak dikenal." });
  } catch (err) {
    return balas({ ok: false, error: String(err) });
  }
}

function buatAcara(b) {
  if (b.token !== TOKEN) return balas({ ok: false, error: "Token tidak sah." });
  if (!b.judul) return balas({ ok: false, error: "Judul wajib diisi." });

  var kode = kodeBaru();
  while (cariAcara(kode)) kode = kodeBaru();   // pastikan unik

  sheet(TAB_ACARA).appendRow([
    kode,
    b.judul,
    b.subjudul || "",
    b.tanggal || "",
    b.lokasi || "",
    (b.fieldAktif || []).join(","),
    JSON.stringify(b.fieldTambahan || []),
    "buka",
    b.dibuatOleh || "",
    new Date(),
  ]);
  return balas({ ok: true, kode: kode });
}

function ubahStatus(b) {
  if (b.token !== TOKEN) return balas({ ok: false, error: "Token tidak sah." });
  var a = cariAcara(b.kode);
  if (!a) return balas({ ok: false, error: "Acara tidak ditemukan." });
  sheet(TAB_ACARA).getRange(a.baris, 8).setValue(b.status === "tutup" ? "tutup" : "buka");
  return balas({ ok: true });
}

function simpanKehadiran(b) {
  var a = cariAcara(b.kode);
  if (!a) return balas({ ok: false, error: "Acara tidak ditemukan." });
  if (a.status === "tutup") return balas({ ok: false, error: "Daftar hadir untuk acara ini sudah ditutup." });
  if (!b.nama || !String(b.nama).trim()) return balas({ ok: false, error: "Nama wajib diisi." });

  // Kunci: dua orang menekan Kirim bersamaan bisa lolos pemeriksaan ganda
  // dan sama-sama tersimpan. Lock membuat pemeriksaan + penulisan jadi satu.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hp = normalHP(b.noHP);

    if (a.fieldAktif.indexOf("noHP") >= 0) {
      if (!hp) return balas({ ok: false, error: "Nomor ponsel wajib diisi." });
      var s = sheet(TAB_HADIR);
      var data = s.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]).toUpperCase() === String(a.kode).toUpperCase() &&
            normalHP(data[i][6]) === hp) {
          return balas({ ok: false, error: "Nomor ponsel ini sudah terdaftar pada acara ini." });
        }
      }
    }

    // Selfie → Drive. File dibiarkan privat (bawaan Drive): hanya pemilik akun
    // yang bisa membukanya. Jangan diubah jadi "anyone with link" — isinya
    // wajah orang.
    var urlFoto = "";
    if (b.foto) {
      var cocok = String(b.foto).match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
      if (cocok) {
        var blob = Utilities.newBlob(
          Utilities.base64Decode(cocok[2]), cocok[1],
          a.kode + "_" + String(b.nama).replace(/[^\w\s.-]/g, "").slice(0, 40) + "_" +
            new Date().getTime() + ".jpg"
        );
        urlFoto = folderFoto().createFile(blob).getUrl();
      }
    }

    sheet(TAB_HADIR).appendRow([
      new Date(), a.kode, a.judul,
      String(b.nama).trim(),
      b.jabatan || "", b.instansi || "",
      hp ? "'" + hp : "",     // apostrof: cegah Sheets memotong angka nol depan
      urlFoto,
      b.tambahan ? JSON.stringify(b.tambahan) : "",
    ]);

    return balas({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
