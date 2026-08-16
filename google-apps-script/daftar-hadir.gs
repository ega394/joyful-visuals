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
 * Data peserta hanya keluar lewat SATU jalan: action "laporan", yang menuntut
 * TOKEN dan hanya melayani SATU acara per permintaan — bukan seluruh isi
 * tabel. Semua action lain tidak pernah mengembalikan data peserta.
 *
 * Artinya TOKEN di bawah kini melindungi data pribadi, bukan sekadar mencegah
 * pembuatan acara sampah. TOKEN ikut terkirim ke browser dan secara teknis
 * bisa ditemukan orang yang memeriksa berkas aplikasi. Perlakukan seperti
 * kunci: ganti bila dicurigai bocor (ubah di sini DAN di Vercel, lalu deploy
 * ulang keduanya).
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

// Ganti dengan kata sandi acak Anda sendiri. Dipakai untuk membuat/menutup
// acara DAN untuk mengambil laporan kehadiran — jaga kerahasiaannya.
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

    // Laporan kehadiran satu acara — untuk dicetak dari aplikasi.
    //
    // Ini SATU-SATUNYA jalan data peserta keluar dari Web App. Sengaja
    // dibatasi per acara (bukan seluruh isi tabel) dan menuntut token,
    // sehingga cakupan kebocoran tetap sempit.
    if (q.action === "laporan") {
      if (q.token !== TOKEN) return balas({ ok: false, error: "Token tidak sah." });
      var ac = cariAcara(q.kode);
      if (!ac) return balas({ ok: false, error: "Acara tidak ditemukan." });

      var sh = sheet(TAB_HADIR);
      var rows = sh ? sh.getDataRange().getValues() : [];
      var peserta = [];
      for (var r = 1; r < rows.length; r++) {
        if (String(rows[r][1]).toUpperCase() !== String(ac.kode).toUpperCase()) continue;
        peserta.push({
          waktu:    rows[r][0] ? Utilities.formatDate(new Date(rows[r][0]), "Asia/Makassar", "dd/MM/yyyy HH:mm") : "",
          nama:     rows[r][3],
          jabatan:  rows[r][4],
          instansi: rows[r][5],
          noHP:     String(rows[r][6] || "").replace(/^'/, ""),
          fotoUrl:  rows[r][7],
          tambahan: rows[r][8] ? JSON.parse(rows[r][8]) : {},
        });
      }

      // Foto hanya bila diminta. Berkas di Drive bersifat privat, jadi URL-nya
      // tidak bisa dipakai langsung sebagai <img> oleh browser — thumbnail
      // dikirim sebagai base64 agar berkas aslinya tetap tidak dibuka aksesnya.
      // Dibatasi jumlahnya karena mengambil thumbnail satu per satu lambat dan
      // Apps Script berhenti pada 6 menit.
      if (q.foto === "1" && peserta.length <= 80) {
        for (var f = 0; f < peserta.length; f++) {
          try {
            var m = String(peserta[f].fotoUrl || "").match(/\/d\/([^/]+)/);
            if (!m) continue;
            var tb = DriveApp.getFileById(m[1]).getThumbnail();
            if (tb) peserta[f].fotoData = "data:" + tb.getContentType() + ";base64," +
              Utilities.base64Encode(tb.getBytes());
          } catch (e) { /* satu foto gagal tidak boleh membatalkan laporan */ }
        }
      }

      return balas({
        ok: true,
        acara: { kode: ac.kode, judul: ac.judul, subjudul: ac.subjudul,
                 tanggal: ac.tanggal, lokasi: ac.lokasi,
                 fieldAktif: ac.fieldAktif, fieldTambahan: ac.fieldTambahan },
        peserta: peserta,
      });
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

  var hp = normalHP(b.noHP);
  if (a.fieldAktif.indexOf("noHP") >= 0 && !hp) {
    return balas({ ok: false, error: "Nomor ponsel wajib diisi." });
  }

  // Unggah foto DI LUAR kunci.
  //
  // Ini bagian paling lambat (1-3 detik). Bila dilakukan sambil memegang
  // kunci, seluruh pengisi lain ikut menunggu — pada acara ramai antreannya
  // cepat melewati batas tunggu dan sebagian orang gagal mengisi. Berkas
  // dibiarkan privat (bawaan Drive): jangan diubah jadi "anyone with link",
  // isinya wajah orang.
  var berkasFoto = null, urlFoto = "";
  if (b.foto) {
    var cocok = String(b.foto).match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
    if (cocok) {
      var blob = Utilities.newBlob(
        Utilities.base64Decode(cocok[2]), cocok[1],
        a.kode + "_" + String(b.nama).replace(/[^\w\s.-]/g, "").slice(0, 40) + "_" +
          new Date().getTime() + ".jpg"
      );
      berkasFoto = folderFoto().createFile(blob);
      urlFoto = berkasFoto.getUrl();
    }
  }

  // Kunci hanya membungkus periksa-ganda + tulis, sehingga dipegang dalam
  // hitungan milidetik. tryLock (bukan waitLock) supaya saat penuh kita bisa
  // membalas pesan yang bisa ditindaklanjuti, bukan melempar exception mentah.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(45000)) {
    if (berkasFoto) { try { berkasFoto.setTrashed(true); } catch (e) {} }
    return balas({ ok: false, error: "Sistem sedang sibuk. Mohon tekan Kirim sekali lagi." });
  }

  try {
    if (hp) {
      // Baca hanya kolom B..G, bukan seluruh grid. Pada acara besar tabel ini
      // terus bertambah dan dibaca ulang setiap orang mengisi — membaca
      // seluruh kolom (termasuk URL foto & data tambahan) memperlambat semua
      // orang yang sedang mengantre.
      var s = sheet(TAB_HADIR);
      var akhir = s.getLastRow();
      if (akhir > 1) {
        var kol = s.getRange(2, 2, akhir - 1, 6).getValues();   // B=kode … G=no_hp
        for (var i = 0; i < kol.length; i++) {
          if (String(kol[i][0]).toUpperCase() === String(a.kode).toUpperCase() &&
              normalHP(kol[i][5]) === hp) {
            if (berkasFoto) { try { berkasFoto.setTrashed(true); } catch (e) {} }
            return balas({ ok: false, error: "Nomor ponsel ini sudah terdaftar pada acara ini." });
          }
        }
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
