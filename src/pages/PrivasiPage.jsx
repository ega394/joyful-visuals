/**
 * /privasi dan /ketentuan — Kebijakan Privasi dan Ketentuan Penggunaan.
 *
 * Dibutuhkan layar persetujuan "Masuk dengan Google" (Google Auth Platform →
 * Branding), dan sepatutnya ada karena formulir publik (permohonan audiensi,
 * peminjaman ruangan, daftar hadir) mengumpulkan data pribadi warga.
 * Halaman statis: tidak memuat data apa pun dan dapat dibuka tanpa akun.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const NAVY = "#0A1628";
const GOLD = "#C9A84C";
const BERLAKU = "13 Oktober 2026";
const NARAHUBUNG = "0811-5961-116";

const H2 = ({ id, children }) => (
  <h2 id={id} style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "8px 0 14px", scrollMarginTop: 24 }}>{children}</h2>
);
const H3 = ({ children }) => (
  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: NAVY, margin: "22px 0 8px" }}>{children}</h3>
);
const P = ({ children }) => <p style={{ margin: "0 0 10px" }}>{children}</p>;
const UL = ({ items }) => (
  <ul style={{ margin: "0 0 10px", paddingLeft: 20, listStyle: "disc" }}>
    {items.map((t, i) => <li key={i} style={{ marginBottom: 5 }}>{t}</li>)}
  </ul>
);

export default function PrivasiPage() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pathname.startsWith("/ketentuan")
      ? "Ketentuan Penggunaan — Prokopim Kota Tarakan"
      : "Kebijakan Privasi — Prokopim Kota Tarakan";
    if (pathname.startsWith("/ketentuan")) document.getElementById("ketentuan")?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: "var(--font-sans)", color: "#334155", lineHeight: 1.7, fontSize: 14.5 }}>
      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1E3A6E 100%)`, padding: "28px 16px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/logo_tarakan.png" alt="" width={44} height={44} style={{ objectFit: "contain" }} />
          <div>
            <div style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Pemerintah Kota Tarakan</div>
            <div style={{ color: "white", fontSize: 17, fontWeight: 800 }}>Prokopim Hibot — Bagian Protokol dan Komunikasi Pimpinan</div>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 48px" }}>
        <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "0 0 16px", fontSize: 13.5 }}>
          <a href="/privasi" style={{ color: NAVY, fontWeight: 700 }}>Kebijakan Privasi</a>
          <span>·</span>
          <a href="/ketentuan" style={{ color: NAVY, fontWeight: 700 }}>Ketentuan Penggunaan</a>
          <span>·</span>
          <a href="/" style={{ color: "#64748B" }}>Kembali ke aplikasi</a>
        </nav>

        <section style={{ background: "white", borderRadius: 14, padding: "22px 20px", border: "1px solid #E2E8F0", marginBottom: 18 }}>
          <H2 id="privasi">Kebijakan Privasi</H2>
          <P>Berlaku sejak {BERLAKU}. Kebijakan ini menjelaskan data pribadi apa yang dikumpulkan aplikasi Prokopim Hibot (prokopim.tarakankota.go.id), untuk apa, dan bagaimana data itu dilindungi. Pengelolanya adalah Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan.</P>

          <H3>1. Data yang dikumpulkan</H3>
          <P><b>Pegawai pengguna aplikasi:</b></P>
          <UL items={[
            "nama, jabatan, nama pengguna, nomor WhatsApp, dan email (bila diisi);",
            "sandi, yang disimpan dalam bentuk teracak (hash), bukan teks aslinya;",
            "catatan aktivitas kerja (jejak audit), misalnya siapa menyetujui jadwal dan kapan;",
            "bila pegawai memilih masuk tanpa sandi: kunci publik passkey perangkatnya, serta nama, alamat email, dan nomor akun Google yang ditautkan.",
          ]} />
          <P>Data sidik jari dan wajah <b>tidak pernah</b> dikirim ke aplikasi. Pencocokannya dilakukan sepenuhnya oleh perangkat pegawai; aplikasi hanya menerima tanda bahwa pencocokan berhasil.</P>
          <P><b>Masyarakat dan instansi pengguna layanan publik:</b></P>
          <UL items={[
            "permohonan audiensi: nama, instansi, nomor WhatsApp, maksud dan keperluan, waktu yang diinginkan, serta kebutuhan aksesibilitas bila ada;",
            "peminjaman ruang rapat: nama penanggung jawab, instansi, nomor WhatsApp, dan rincian kegiatan;",
            "daftar hadir digital: nama, jabatan, instansi, dan isian lain yang diminta penyelenggara acara (misalnya nomor telepon atau tanda tangan).",
          ]} />

          <H3>2. Tujuan penggunaan</H3>
          <UL items={[
            "menyusun, memeriksa, dan menetapkan jadwal kegiatan Pimpinan Daerah;",
            "memproses permohonan audiensi, peminjaman ruang rapat, dan daftar hadir;",
            "mengirim pemberitahuan terkait layanan tersebut melalui WhatsApp atau notifikasi aplikasi;",
            "menjaga keamanan akun dan mencatat jejak keputusan sebagai bahan pertanggungjawaban kedinasan.",
          ]} />
          <P>Data tidak dipakai untuk iklan, tidak dijual, dan tidak diserahkan kepada pihak lain di luar keperluan kedinasan, kecuali diwajibkan peraturan perundang-undangan.</P>

          <H3>3. Data dari akun Google</H3>
          <P>Bila pegawai memilih "Masuk dengan Google", aplikasi hanya menerima nama, alamat email, dan nomor akun Google, semata-mata untuk mencocokkan akun Google itu dengan akun pegawai yang sudah ditautkan. Aplikasi tidak meminta dan tidak dapat mengakses Gmail, Google Drive pribadi, kontak, maupun kalender pribadi pengguna. Penggunaan data dari Google mematuhi Kebijakan Data Pengguna Layanan API Google (Google API Services User Data Policy), termasuk ketentuan Penggunaan Terbatas (Limited Use). Tautan dapat diputus kapan saja oleh pegawai melalui Profil → Cara Masuk.</P>

          <H3>4. Penyimpanan dan pihak pemroses</H3>
          <P>Data disimpan pada layanan basis data dan peladen awan yang dipakai aplikasi, dengan pusat data di Singapura. Untuk menjalankan fungsinya, aplikasi memakai penyedia layanan berikut sebagai pemroses: Supabase (basis data), Vercel (peladen aplikasi), penyedia gerbang WhatsApp (pengiriman pemberitahuan), dan Google (masuk dengan akun Google serta penyimpanan berkas kedinasan). Seluruh pengiriman data melalui sambungan terenkripsi (HTTPS), dan akses di dalam aplikasi dibatasi menurut peran dan kewenangan.</P>

          <H3>5. Masa simpan</H3>
          <P>Salinan pesan WhatsApp yang dikirim aplikasi (penerima, nomor, isi pesan, dan status pengiriman) disimpan agar petugas dapat memastikan pemberitahuan benar-benar sampai. Salinan ini hanya dapat dilihat pejabat yang berwenang, isi kode OTP tidak pernah disimpan, dan nomor, nama, serta isi pesan dihapus otomatis sesudah 90 hari.</P>
          <P>Data lainnya disimpan selama diperlukan untuk pelaksanaan tugas dan sesuai ketentuan kearsipan yang berlaku. Passkey dan tautan akun Google dapat dihapus sendiri oleh pegawai kapan saja, dan dicabut oleh Administrator bila akun dinonaktifkan.</P>

          <H3>6. Hak pemilik data</H3>
          <P>Sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, pemilik data dapat meminta akses, perbaikan, atau penghapusan data pribadinya, sepanjang tidak bertentangan dengan kewajiban kearsipan dan peraturan perundang-undangan. Permintaan disampaikan melalui narahubung di bawah.</P>

          <H3>7. Perubahan kebijakan</H3>
          <P>Kebijakan ini dapat diperbarui. Versi terbaru selalu tersedia di halaman ini beserta tanggal berlakunya.</P>
        </section>

        <section style={{ background: "white", borderRadius: 14, padding: "22px 20px", border: "1px solid #E2E8F0", marginBottom: 18 }}>
          <H2 id="ketentuan">Ketentuan Penggunaan</H2>
          <UL items={[
            "Prokopim Hibot adalah aplikasi kedinasan Pemerintah Kota Tarakan. Bagian internalnya hanya untuk pegawai yang diberi akun oleh Bagian Protokol dan Komunikasi Pimpinan.",
            "Akun bersifat pribadi: sandi, perangkat passkey, dan akun Google yang ditautkan tidak boleh dipinjamkan atau dipakai orang lain.",
            "Informasi agenda Pimpinan Daerah di dalam aplikasi bersifat terbatas dan hanya digunakan untuk keperluan tugas.",
            "Layanan publik (permohonan audiensi, peminjaman ruang rapat, daftar hadir) digunakan dengan data yang benar dan untuk keperluan resmi.",
            "Penyalahgunaan, termasuk percobaan masuk tanpa hak atau pengiriman data palsu, dapat mengakibatkan akun dinonaktifkan dan diproses sesuai peraturan yang berlaku.",
          ]} />
        </section>

        <section style={{ background: "white", borderRadius: 14, padding: "18px 20px", border: "1px solid #E2E8F0" }}>
          <H3>Narahubung</H3>
          <P>Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan<br />WhatsApp admin: {NARAHUBUNG}</P>
        </section>
      </main>
    </div>
  );
}
