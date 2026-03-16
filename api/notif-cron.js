// ============================================================
//  /api/notif-cron.js — Dispatcher Notifikasi Terjadwal
//  Satu file untuk semua cron, routing via ?type=
//
//  vercel.json:
//  { "path": "/api/notif-cron?type=pagi",     "schedule": "30 23 * * *" }  → 07:30 WITA
//  { "path": "/api/notif-cron?type=reminder",  "schedule": "55 7 * * *"  }  → 15:55 WITA
//  { "path": "/api/notif-cron?type=ajudan",    "schedule": "0 8 * * *"   }  → 16:00 WITA
//  { "path": "/api/notif-cron?type=personil",  "schedule": "10 8 * * *"  }  → 16:10 WITA
// ============================================================

const SUPA_URL = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL  || "";
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
const FONNTE   = process.env.FONNTE_TOKEN || "";
const LINK     = "prokopim.tarakankota.go.id";
const FOOTER   = "\n_Prokopim Kota Tarakan_\n_" + LINK + "_";

const H = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPA_KEY,
  "Authorization": "Bearer " + SUPA_KEY,
});

// ── Supabase helpers ─────────────────────────────────────────
async function getAllJadwal() {
  const r = await fetch(SUPA_URL + "/rest/v1/jadwal?select=data&order=id", { headers: H() });
  if (!r.ok) throw new Error("Gagal ambil jadwal: " + r.status);
  return (await r.json()).map(x => x.data).filter(Boolean);
}

async function getAllUsers() {
  const r = await fetch(SUPA_URL + "/rest/v1/users?select=*", { headers: H() });
  if (!r.ok) throw new Error("Gagal ambil users: " + r.status);
  return await r.json();
}

// ── Tanggal helpers ──────────────────────────────────────────
function getTodayWITA() {
  return new Date(Date.now() + 8*60*60*1000).toISOString().slice(0,10);
}
function getTomorrowWITA() {
  return new Date(Date.now() + 8*60*60*1000 + 24*60*60*1000).toISOString().slice(0,10);
}

const HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BULAN = ["","Januari","Februari","Maret","April","Mei","Juni",
               "Juli","Agustus","September","Oktober","November","Desember"];
function fmtTgl(tgl) {
  const [y,m,d] = tgl.split("-").map(Number);
  return HARI[new Date(y,m-1,d).getDay()] + ", " + d + " " + BULAN[m] + " " + y;
}

// ── WhatsApp helper ──────────────────────────────────────────
async function kirimWA(noWA, pesan) {
  const nomor = noWA.trim().replace(/^0/,"62").replace(/\D/g,"");
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: nomor, message: pesan }),
    });
    return (await r.json()).status !== false;
  } catch(e) {
    console.error("[cron] Gagal kirim ke", nomor, e.message);
    return false;
  }
}

// ── Status kehadiran ─────────────────────────────────────────
function statusKehadiran(ev, pim) {
  const s = pim === "wk" ? ev.statusWK : ev.statusWWK;
  if (pim === "wk" && ev.delegasiKeWWK) return "↩️ Delegasi ke Wakil WK";
  if (!s)                 return "⚠️ Belum konfirmasi";
  if (s === "hadir")      return "✅";
  if (s === "tidak_hadir")return "❌ Tidak hadir";
  if (s === "diwakilkan") {
    const nama = pim === "wk" ? ev.perwakilanWK : ev.perwakilanWWK;
    return "🔄 Diwakilkan" + (nama ? ": " + nama : "");
  }
  return s;
}

function pimpinanLabel(ev) {
  const list = [];
  if ((ev.untukPimpinan||[]).includes("walikota"))
    list.push(ev.delegasiKeWWK ? "WK (Delegasi ke WWK)" : "WK");
  if ((ev.untukPimpinan||[]).includes("wakilwalikota") || ev.delegasiKeWWK)
    list.push("WWK");
  return list.join(" & ") || "-";
}

// ════════════════════════════════════════════════════════════
//  TYPE: pagi — 07:30 WITA
//  Kabag, Kasubbag Komdokpim, Ajudan WK/WWK, Personil (jika punya penugasan)
// ════════════════════════════════════════════════════════════
function pesanKabag(events, tgl, userMap) {
  const sorted = [...events].sort((a,b)=>(a.jam||"").localeCompare(b.jam||""));
  const wkNama  = Object.values(userMap).find(u=>u.role==="walikota")?.nama  || "Wali Kota";
  const wwkNama = Object.values(userMap).find(u=>u.role==="wakilwalikota")?.nama || "Wakil Wali Kota";
  const lines = ["🗓️ *Rekap Agenda Pimpinan — Hari Ini*", fmtTgl(tgl), ""];
  sorted.forEach((ev,i) => {
    const hadirWK  = (ev.untukPimpinan||[]).includes("walikota");
    const hadirWWK = (ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;
    const pers = (ev.personil||[]).map(un=>userMap[un]?.nama||un).join(", ") || "—";
    lines.push((i+1)+". ⏰ "+(ev.jam||"-")+" | *"+(ev.namaAcara||"-")+"*");
    if (ev.lokasi)        lines.push("   📍 "+ev.lokasi);
    if (ev.penyelenggara) lines.push("   🏢 "+ev.penyelenggara);
    if (hadirWK)  lines.push("   👔 "+wkNama+" "+statusKehadiran(ev,"wk"));
    if (hadirWWK) lines.push("   👔 "+wwkNama+" "+statusKehadiran(ev,"wwk"));
    lines.push("   🎯 Bertugas: "+pers, "");
  });
  lines.push("_Total: "+events.length+" kegiatan hari ini_", FOOTER);
  return lines.join("\n");
}

function pesanKasubbagKomdok(events, tgl, userMap) {
  const sorted = [...events].sort((a,b)=>(a.jam||"").localeCompare(b.jam||""));
  const lines = ["🗓️ *Rekap Lengkap Agenda Pimpinan — Hari Ini*", fmtTgl(tgl), ""];
  sorted.forEach((ev,i) => {
    const hadirWK  = (ev.untukPimpinan||[]).includes("walikota");
    const hadirWWK = (ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;
    const pers = (ev.personil||[]).map(un=>userMap[un]?.nama||un).join(", ") || "—";
    lines.push((i+1)+". ⏰ "+(ev.jam||"-")+" | *"+(ev.namaAcara||"-")+"*");
    if (ev.lokasi)        lines.push("   📍 "+ev.lokasi);
    if (ev.penyelenggara) lines.push("   🏢 "+ev.penyelenggara);
    if (hadirWK)  lines.push("   👔 Wali Kota "+statusKehadiran(ev,"wk"));
    if (hadirWWK) lines.push("   👔 Wakil Wali Kota "+statusKehadiran(ev,"wwk"));
    lines.push("   🎯 Bertugas: "+pers);
    lines.push("   📝 Sambutan: "+(ev.sambutanFile?"✅ Tersedia":"❌ Belum ada"), "");
  });
  lines.push("_Total: "+events.length+" kegiatan hari ini_", FOOTER);
  return lines.join("\n");
}

function pesanAjudanPagi(events, tgl, userMap, pim) {
  const label = pim==="wk" ? "Wali Kota" : "Wakil Wali Kota";
  const filtered = events.filter(ev =>
    pim==="wk"
      ? (ev.untukPimpinan||[]).includes("walikota")
      : (ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK
  ).sort((a,b)=>(a.jam||"").localeCompare(b.jam||""));
  if (!filtered.length) return null;
  const lines = ["🌅 *Selamat Pagi!*", "*Agenda "+label+" — Hari Ini*", fmtTgl(tgl), ""];
  filtered.forEach((ev,i) => {
    const pers = (ev.personil||[]).map(un=>userMap[un]?.nama||un).join(", ") || "—";
    lines.push((i+1)+". ⏰ "+(ev.jam||"-")+" | *"+(ev.namaAcara||"-")+"*");
    if (ev.lokasi)        lines.push("   📍 "+ev.lokasi);
    if (ev.penyelenggara) lines.push("   🏢 "+ev.penyelenggara);
    lines.push("   👔 "+label+" "+statusKehadiran(ev, pim));
    lines.push("   🎯 Bertugas: "+pers, "");
  });
  lines.push(FOOTER);
  return lines.join("\n");
}

function pesanPersonilPagi(events, tgl, userMap) {
  const sorted = [...events].sort((a,b)=>(a.jam||"").localeCompare(b.jam||""));
  const lines = ["🌅 *Selamat Pagi!*", fmtTgl(tgl), "", "Agenda Pimpinan hari ini:", ""];
  sorted.forEach((ev,i) => {
    const hadirWK  = (ev.untukPimpinan||[]).includes("walikota");
    const hadirWWK = (ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;
    const pers = (ev.personil||[]).map(un=>userMap[un]?.nama||un).join(", ") || "—";
    lines.push((i+1)+". ⏰ "+(ev.jam||"-")+" | *"+(ev.namaAcara||"-")+"*");
    if (ev.lokasi)        lines.push("   📍 "+ev.lokasi);
    if (ev.penyelenggara) lines.push("   🏢 "+ev.penyelenggara);
    if (hadirWK)  lines.push("   👔 Wali Kota "+statusKehadiran(ev,"wk"));
    if (hadirWWK) lines.push("   👔 Wakil Wali Kota "+statusKehadiran(ev,"wwk"));
    lines.push("   🎯 Personil bertugas: "+pers, "");
  });
  lines.push(FOOTER);
  return lines.join("\n");
}

async function handlePagi(userMap, allUsers) {
  const today = getTodayWITA();
  const events = (await getAllJadwal()).filter(ev =>
    ev.tanggal===today && ev.alur==="disetujui" && !ev.tersembunyi
  );
  if (!events.length) return { sent:0, message:"Tidak ada kegiatan hari ini" };

  const PERSONIL_ROLES = ["staf","admin_rk","timkom","kasubbag_protokol","kasubbag_komdokpim"];
  let sent=0, failed=0, results=[];
  for (const u of allUsers) {
    if (!u.noWA) continue;
    let pesan = null;
    if      (u.role==="kabag")               pesan = pesanKabag(events, today, userMap);
    else if (u.role==="kasubbag_komdokpim")  pesan = pesanKasubbagKomdok(events, today, userMap);
    else if (u.role==="ajudan_walikota")     pesan = pesanAjudanPagi(events, today, userMap, "wk");
    else if (u.role==="ajudan_wakilwalikota")pesan = pesanAjudanPagi(events, today, userMap, "wwk");
    else if (PERSONIL_ROLES.includes(u.role)) {
      if (events.some(ev=>(ev.personil||[]).includes(u.username)))
        pesan = pesanPersonilPagi(events, today, userMap);
    }
    if (!pesan) continue;
    const ok = await kirimWA(u.noWA, pesan);
    if (ok) sent++; else failed++;
    results.push({ username:u.username, role:u.role, ok });
    await new Promise(r=>setTimeout(r,300));
  }
  return { sent, failed, results, kegiatanCount:events.length };
}

// ════════════════════════════════════════════════════════════
//  TYPE: reminder — 15:55 WITA
//  Kasubbag Protokol & Komdokpim: pengingat penugasan besok
// ════════════════════════════════════════════════════════════
function punyaPersonilDariRole(ev, roles, userMap) {
  return (ev.personil||[]).some(un => roles.includes(userMap[un]?.role));
}

function pesanPengingat(evBelum, tglBesok, today) {
  const sorted = [...evBelum].sort((a,b)=>(a.jam||"").localeCompare(b.jam||""));
  const lines = [
    "⚠️ *Pengingat Penugasan — Besok*",
    fmtTgl(today)+" | 15.55 WITA", "",
    "Kegiatan besok yang *belum ada penugasan*:", "",
  ];
  sorted.forEach((ev,i) => {
    lines.push((i+1)+". ⏰ "+(ev.jam||"-")+" | *"+(ev.namaAcara||"-")+"*");
    if (ev.lokasi) lines.push("   📍 "+ev.lokasi);
    lines.push("   👔 "+pimpinanLabel(ev));
    if (ev.sambutanFile!==undefined)
      lines.push("   📝 Sambutan: "+(ev.sambutanFile?"✅ Tersedia":"❌ Belum ada"));
    lines.push("");
  });
  lines.push("Mohon segera input penugasan melalui:\n🔗 "+LINK, FOOTER);
  return lines.join("\n");
}

async function handleReminder(userMap, allUsers) {
  const tglBesok = getTomorrowWITA();
  const today    = getTodayWITA();
  const events   = (await getAllJadwal()).filter(ev =>
    ev.tanggal===tglBesok && ev.alur==="disetujui" && !ev.tersembunyi
  );
  if (!events.length) return { sent:0, message:"Tidak ada kegiatan besok" };

  const PROT_ROLES  = ["staf","admin_rk","kasubbag_protokol"];
  const KOMDOK_ROLES = ["timkom","kasubbag_komdokpim"];
  const belumProt   = events.filter(ev=>!punyaPersonilDariRole(ev,PROT_ROLES,userMap));
  const belumKomdok = events.filter(ev=>!punyaPersonilDariRole(ev,KOMDOK_ROLES,userMap));

  let sent=0, failed=0, results=[];
  for (const u of allUsers) {
    if (!u.noWA) continue;
    let evBelum = null;
    if (u.role==="kasubbag_protokol"  && belumProt.length)   evBelum = belumProt;
    if (u.role==="kasubbag_komdokpim" && belumKomdok.length) evBelum = belumKomdok;
    if (!evBelum) continue;
    const ok = await kirimWA(u.noWA, pesanPengingat(evBelum, tglBesok, today));
    if (ok) sent++; else failed++;
    results.push({ username:u.username, role:u.role, eventCount:evBelum.length, ok });
    await new Promise(r=>setTimeout(r,300));
  }
  return { sent, failed, results, belumProt:belumProt.length, belumKomdok:belumKomdok.length };
}

// ════════════════════════════════════════════════════════════
//  TYPE: ajudan — 16:00 WITA
//  Ajudan WK & WWK: rekap besok + pengingat konfirmasi kehadiran
// ════════════════════════════════════════════════════════════
function pesanAjudanBesok(events, tglBesok, label) {
  const sorted = [...events].sort((a,b)=>(a.jam||"").localeCompare(b.jam||""));
  const lines = ["📋 *Agenda "+label+" Besok*", fmtTgl(tglBesok), ""];
  sorted.forEach((ev,i) => {
    lines.push((i+1)+". ⏰ "+(ev.jam||"-")+" | *"+(ev.namaAcara||"-")+"*");
    if (ev.lokasi)        lines.push("   📍 "+ev.lokasi);
    if (ev.penyelenggara) lines.push("   🏢 "+ev.penyelenggara);
    lines.push("");
  });
  lines.push(
    "⚠️ *Mohon segera konfirmasi kehadiran "+label+"* untuk "+events.length+" kegiatan di atas.",
    "Hubungi Pimpinan hari ini dan input konfirmasi melalui:",
    "🔗 "+LINK, FOOTER
  );
  return lines.join("\n");
}

async function handleAjudan(userMap, allUsers) {
  const tglBesok = getTomorrowWITA();
  const besokAll = (await getAllJadwal()).filter(ev =>
    ev.tanggal===tglBesok && ev.alur==="disetujui" && !ev.tersembunyi
  );
  const besokWK  = besokAll.filter(ev=>(ev.untukPimpinan||[]).includes("walikota"));
  const besokWWK = besokAll.filter(ev=>(ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK);

  let sent=0, failed=0, results=[];
  for (const u of allUsers) {
    if (!u.noWA) continue;
    let pesan = null;
    if (u.role==="ajudan_walikota"      && besokWK.length)  pesan = pesanAjudanBesok(besokWK,  tglBesok, "Wali Kota");
    if (u.role==="ajudan_wakilwalikota" && besokWWK.length) pesan = pesanAjudanBesok(besokWWK, tglBesok, "Wakil Wali Kota");
    if (!pesan) continue;
    const ok = await kirimWA(u.noWA, pesan);
    if (ok) sent++; else failed++;
    results.push({ username:u.username, role:u.role, ok });
    await new Promise(r=>setTimeout(r,300));
  }
  return { sent, failed, results, besokWK:besokWK.length, besokWWK:besokWWK.length };
}

// ════════════════════════════════════════════════════════════
//  TYPE: personil — 16:10 WITA
//  Personil/Staf: rekap penugasan besok
// ════════════════════════════════════════════════════════════
function pesanPersonilBesok(namaPersonil, events, tglBesok, userMap) {
  const sorted = [...events].sort((a,b)=>(a.jam||"").localeCompare(b.jam||""));
  const lines = ["📋 *Agenda & Penugasan Besok*", fmtTgl(tglBesok), "", "*"+namaPersonil+"* bertugas pada:", ""];
  sorted.forEach((ev,i) => {
    const hadirWK  = (ev.untukPimpinan||[]).includes("walikota");
    const hadirWWK = (ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;
    const rekan    = (ev.personil||[]).filter(un=>userMap[un]?.nama!==namaPersonil)
                       .map(un=>userMap[un]?.nama||un);
    lines.push((i+1)+". ⏰ "+(ev.jam||"-")+" | *"+(ev.namaAcara||"-")+"*");
    if (ev.lokasi)         lines.push("   📍 "+ev.lokasi);
    if (ev.penyelenggara)  lines.push("   🏢 "+ev.penyelenggara);
    if (hadirWK)  lines.push("   👔 Wali Kota");
    if (hadirWWK) lines.push("   👔 Wakil Wali Kota");
    if (ev.catatanPenugasan) lines.push("   📝 "+ev.catatanPenugasan);
    if (rekan.length) lines.push("   🤝 Bertugas bersama: "+rekan.join(", "));
    lines.push("");
  });
  lines.push("Silakan siapkan perlengkapan yang diperlukan. Sampai jumpa besok! 🙏", FOOTER);
  return lines.join("\n");
}

async function handlePersonil(userMap, allUsers) {
  const tglBesok = getTomorrowWITA();
  const besok    = (await getAllJadwal()).filter(ev =>
    ev.tanggal===tglBesok && ev.alur==="disetujui" && !ev.tersembunyi
  );
  if (!besok.length) return { sent:0, message:"Tidak ada kegiatan besok" };

  const personilBesok = new Map();
  besok.forEach(ev => {
    (ev.personil||[]).forEach(un => {
      if (!personilBesok.has(un)) personilBesok.set(un,[]);
      personilBesok.get(un).push(ev);
    });
  });

  let sent=0, failed=0, results=[];
  for (const [un, evMereka] of personilBesok) {
    const u = userMap[un];
    if (!u?.noWA) continue;
    const ok = await kirimWA(u.noWA, pesanPersonilBesok(u.nama||un, evMereka, tglBesok, userMap));
    if (ok) sent++; else failed++;
    results.push({ username:un, jumlahKegiatan:evMereka.length, ok });
    await new Promise(r=>setTimeout(r,300));
  }
  return { sent, failed, results, personilCount:personilBesok.size };
}

// ════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const cronSecret   = process.env.CRON_SECRET || "";
  const authHeader   = req.headers["authorization"] || "";
  const isManual     = cronSecret && authHeader === "Bearer " + cronSecret;

  if (!isVercelCron && !isManual)
    return res.status(401).json({ error: "Unauthorized" });
  if (!SUPA_URL || !SUPA_KEY)
    return res.status(500).json({ error: "Supabase env belum diset" });

  const type = req.query?.type || "";
  if (!["pagi","reminder","ajudan","personil"].includes(type))
    return res.status(400).json({ error: "type tidak valid. Gunakan: pagi | reminder | ajudan | personil" });

  console.log("[notif-cron] type:", type);

  try {
    const allUsers = await getAllUsers();
    const userMap  = {};
    allUsers.forEach(u => { userMap[u.username] = u; });

    let result;
    if      (type==="pagi")     result = await handlePagi(userMap, allUsers);
    else if (type==="reminder") result = await handleReminder(userMap, allUsers);
    else if (type==="ajudan")   result = await handleAjudan(userMap, allUsers);
    else if (type==="personil") result = await handlePersonil(userMap, allUsers);

    console.log("[notif-cron]", type, "selesai:", result);
    return res.status(200).json({ ok:true, type, ...result });

  } catch(err) {
    console.error("[notif-cron] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
