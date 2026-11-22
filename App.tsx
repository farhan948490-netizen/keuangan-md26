import { useEffect, useMemo, useState } from "react";
import { supabase, hasSupabaseConfig } from "./lib/supabase";
import type { Profile, CashTransaction, Payment, Role } from "./types";
import { Wallet, LayoutDashboard, Users, ReceiptText, ArrowLeftRight, FileText, LogOut, Plus, Upload, Check, X, RefreshCw, Menu, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const dateLabel = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
type Tab = "dashboard" | "anggota" | "pembayaran" | "transaksi" | "laporan";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) loadProfile();
    else setProfile(null);
  }, [session]);

  useEffect(() => { if (profile) refresh(); }, [profile]);

  async function loadProfile() {
    const { data, error } = await supabase.from("profiles").select("id,full_name,student_number,role").eq("id", session.user.id).single();
    if (error) setMessage("Profil belum tersedia. Minta Admin memeriksa akun ini.");
    else setProfile(data as Profile);
  }
  async function refresh() {
    setBusy(true);
    const [t, p, m] = await Promise.all([
      supabase.from("cash_transactions").select("*").order("transaction_date", { ascending: false }).limit(500),
      supabase.from("payments").select("*, profiles(full_name,student_number)").order("created_at", { ascending: false }).limit(300),
      supabase.from("profiles").select("id,full_name,student_number,role").order("full_name")
    ]);
    if (!t.error) setTransactions((t.data || []) as CashTransaction[]);
    if (!p.error) setPayments((p.data || []) as Payment[]);
    if (!m.error) setMembers((m.data || []) as Profile[]);
    setBusy(false);
    if (t.error || p.error || m.error) setMessage("Sebagian data belum dapat dimuat. Periksa skema database dan hak akses Supabase.");
  }
  const totalIncome = transactions.filter(x => x.type === "income").reduce((a,x) => a + Number(x.amount), 0);
  const totalExpense = transactions.filter(x => x.type === "expense").reduce((a,x) => a + Number(x.amount), 0);
  const balance = totalIncome - totalExpense;
  const canManage = profile?.role === "admin" || profile?.role === "bendahara";
  const nav = [
    ["dashboard", "Dashboard", LayoutDashboard], ["anggota", "Data Anggota", Users],
    ["pembayaran", "Pembayaran Kas", ReceiptText], ["transaksi", "Transaksi", ArrowLeftRight], ["laporan", "Laporan", FileText]
  ] as const;

  if (!hasSupabaseConfig) return <SetupScreen />;
  if (!session) return <AuthScreen />;
  if (!profile) return <div className="center"><div className="spinner" />Memuat profil akun…</div>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="brand"><div className="brand-icon"><Wallet size={23}/></div><div><b>KasKita</b><small>MD 2026</small></div></div>
      <div className="class-label">UIN SUNAN KALIJAGA</div>
      <nav>{nav.map(([id,label,Icon]) => <button key={id} className={tab===id?"nav-item active":"nav-item"} onClick={()=>{setTab(id);setMobileMenu(false)}}><Icon size={18}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{profile.full_name.slice(0,1).toUpperCase()}</div><div className="user-info"><b>{profile.full_name}</b><small>{roleLabel(profile.role)}</small></div></div><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/> Keluar</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="icon-button mobile-only" onClick={()=>setMobileMenu(!mobileMenu)}><Menu/></button><div><div className="eyebrow">MANAJEMEN DAKWAH · 2026</div><h1>{nav.find(x=>x[0]===tab)?.[1]}</h1></div><div className="top-actions"><span className="role-pill"><ShieldCheck size={14}/>{roleLabel(profile.role)}</span><button className="icon-button" onClick={refresh} title="Muat ulang"><RefreshCw size={17}/></button></div></header>
      {message && <div className="notice">{message}<button onClick={()=>setMessage("")}>×</button></div>}
      {tab==="dashboard" && <Dashboard balance={balance} income={totalIncome} expense={totalExpense} members={members} payments={payments} transactions={transactions} />}
      {tab==="anggota" && <Members members={members}/>}
      {tab==="pembayaran" && <Payments payments={payments} profile={profile} canManage={!!canManage} refresh={refresh} notify={setMessage}/>}
      {tab==="transaksi" && <Transactions transactions={transactions} canManage={!!canManage} refresh={refresh} notify={setMessage}/>}
      {tab==="laporan" && <Reports transactions={transactions} payments={payments} balance={balance}/>}
      <footer>KasKita · Manajemen Dakwah MD 2026 · UIN Sunan Kalijaga Yogyakarta</footer>
    </main>
  </div>;
}

function SetupScreen() {
  return <div className="auth-wrap"><div className="auth-card"><div className="brand centered"><div className="brand-icon"><Wallet/></div><div><b>KasKita</b><small>MD 2026</small></div></div><h1>Hubungkan Supabase</h1><p>Aplikasi sudah terpasang. Tambahkan URL dan anon/publishable key Supabase melalui Environment Variables di Vercel atau file <code>.env</code> lokal.</p><ol><li>Buat project di Supabase.</li><li>Jalankan file <code>supabase/schema.sql</code> di SQL Editor.</li><li>Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code>.</li></ol><p className="muted">Jangan pernah memasukkan service_role key ke aplikasi frontend atau GitHub.</p></div></div>;
}
function AuthScreen() {
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [name,setName]=useState(""); const [nim,setNim]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg("");
    if(mode==="login") {
      const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)setMsg(error.message);
    } else {
      const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name,student_number:nim}}});
      if(error)setMsg(error.message); else setMsg("Pendaftaran berhasil. Jika konfirmasi email aktif, cek email untuk verifikasi. Role awal akun adalah Anggota.");
    }
    setLoading(false);
  }
  return <div className="auth-wrap"><form className="auth-card" onSubmit={submit}><div className="brand centered"><div className="brand-icon"><Wallet/></div><div><b>KasKita</b><small>MD 2026 · UIN Sunan Kalijaga</small></div></div><h1>{mode==="login"?"Selamat datang kembali":"Buat akun KasKita"}</h1><p className="muted">Sistem kas kelas Manajemen Dakwah angkatan 2026.</p>
    {mode==="signup"&&<><label>Nama lengkap<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nama sesuai identitas"/></label><label>NIM<input value={nim} onChange={e=>setNim(e.target.value)} placeholder="Nomor induk mahasiswa"/></label></>}
    <label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com"/></label><label>Password<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter"/></label>
    {msg&&<div className="notice">{msg}</div>}<button className="primary full" disabled={loading}>{loading?"Memproses…":mode==="login"?"Masuk":"Daftar akun"}</button><p className="switch">{mode==="login"?"Belum punya akun?":"Sudah punya akun?"} <button type="button" onClick={()=>{setMode(mode==="login"?"signup":"login");setMsg("")}}>{mode==="login"?"Daftar":"Masuk"}</button></p></form></div>;
}
function Dashboard({balance,income,expense,members,payments,transactions}:{balance:number;income:number;expense:number;members:Profile[];payments:Payment[];transactions:CashTransaction[]}) {
  const chart=useMemo(()=>{const map=new Map<string,{bulan:string;pemasukan:number;pengeluaran:number}>();transactions.forEach(t=>{const d=new Date(t.transaction_date);const k=`${d.getFullYear()}-${d.getMonth()}`;const label=d.toLocaleDateString("id-ID",{month:"short",year:"2-digit"});const v=map.get(k)||{bulan:label,pemasukan:0,pengeluaran:0};v[t.type==="income"?"pemasukan":"pengeluaran"]+=Number(t.amount);map.set(k,v)});return [...map.values()].slice(-6)},[transactions]);
  const pending=payments.filter(p=>p.status==="pending").length;
  return <><div className="welcome"><div><h2>Ringkasan keuangan kelas</h2><p>Semua angka dihitung dari transaksi yang tersimpan di database.</p></div><span className="live-dot">Data Supabase</span></div><div className="stats-grid"><Stat label="Saldo kas" value={rupiah(balance)} icon={<Wallet/>}/><Stat label="Total pemasukan" value={rupiah(income)} icon={<Plus/>}/><Stat label="Total pengeluaran" value={rupiah(expense)} icon={<ArrowLeftRight/>}/><Stat label="Jumlah anggota" value={String(members.length)} icon={<Users/>}/></div><div className="two-col"><section className="panel"><div className="panel-head"><div><h3>Arus kas</h3><p>Pemasukan dan pengeluaran per bulan</p></div></div>{chart.length?<div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="bulan"/><YAxis tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={(v:any)=>rupiah(Number(v))}/><Bar dataKey="pemasukan" fill="#247a62" radius={[5,5,0,0]}/><Bar dataKey="pengeluaran" fill="#e5a34d" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>:<Empty text="Belum ada transaksi untuk ditampilkan."/>}</section><section className="panel"><div className="panel-head"><div><h3>Status pembayaran</h3><p>Ringkasan pengajuan pembayaran</p></div></div><div className="payment-summary"><div><b>{payments.filter(p=>p.status==="approved").length}</b><span>Disetujui</span></div><div><b>{pending}</b><span>Menunggu</span></div><div><b>{payments.filter(p=>p.status==="rejected").length}</b><span>Ditolak</span></div></div><p className="muted small">Total anggota terdaftar: {members.length}</p></section></div><section className="panel"><div className="panel-head"><div><h3>Transaksi terbaru</h3><p>Catatan keuangan terbaru</p></div></div><TransactionTable transactions={transactions.slice(0,6)}/></section></>;
}
function Stat({label,value,icon}:{label:string;value:string;icon:React.ReactNode}) {return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong></div>}
function Members({members}:{members:Profile[]}) {return <section className="panel"><div className="panel-head"><div><h3>Data anggota</h3><p>Daftar akun yang terdaftar di KasKita</p></div><span className="count">{members.length} akun</span></div><div className="table-wrap"><table><thead><tr><th>Nama</th><th>NIM</th><th>Hak akses</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td><b>{m.full_name}</b></td><td>{m.student_number||"—"}</td><td><span className="status">{roleLabel(m.role)}</span></td></tr>)}</tbody></table>{!members.length&&<Empty text="Belum ada anggota."/>}</div></section>}
function Payments({payments,profile,canManage,refresh,notify}:{payments:Payment[];profile:Profile;canManage:boolean;refresh:()=>void;notify:(s:string)=>void}) {
  const [period,setPeriod]=useState("");const [amount,setAmount]=useState("25000");const [file,setFile]=useState<File|null>(null);const [loading,setLoading]=useState(false);
  async function submit(e:React.FormEvent) {e.preventDefault();if(!file){notify("Pilih bukti pembayaran terlebih dahulu.");return;}setLoading(true);const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${profile.id}/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from("payment-proofs").upload(path,file,{upsert:false});if(up.error){notify(up.error.message);setLoading(false);return;}const ins=await supabase.from("payments").insert({user_id:profile.id,period,amount:Number(amount),proof_path:path});if(ins.error)notify(ins.error.message);else{notify("Bukti pembayaran berhasil dikirim untuk diperiksa.");setPeriod("");setFile(null);refresh();}setLoading(false);}
  async function decide(p:Payment,status:"approved"|"rejected") {const {error}=await supabase.from("payments").update({status}).eq("id",p.id);if(error)notify(error.message);else{notify(`Pembayaran ${status==="approved"?"disetujui":"ditolak"}.`);refresh();}}
  const visible=canManage?payments:payments.filter(p=>p.user_id===profile.id);
  return <div className="stack">{!canManage&&<form className="panel form-grid" onSubmit={submit}><div className="panel-head full-span"><div><h3>Kirim bukti pembayaran</h3><p>Unggah bukti transfer atau pembayaran tunai yang sudah dilakukan.</p></div></div><label>Periode pembayaran<input required value={period} onChange={e=>setPeriod(e.target.value)} placeholder="Contoh: November 2026"/></label><label>Nominal (Rp)<input required type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="full-span">Bukti pembayaran<input required type="file" accept="image/*,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button className="primary" disabled={loading}><Upload size={16}/>{loading?"Mengirim…":"Kirim bukti"}</button></form>}
  <section className="panel"><div className="panel-head"><div><h3>{canManage?"Verifikasi pembayaran":"Riwayat pembayaran"}</h3><p>{canManage?"Periksa bukti dan perbarui status pengajuan.":"Status pembayaran kas kamu."}</p></div></div><div className="table-wrap"><table><thead><tr><th>Anggota</th><th>Periode</th><th>Nominal</th><th>Bukti</th><th>Status</th>{canManage&&<th>Aksi</th>}</tr></thead><tbody>{visible.map(p=><tr key={p.id}><td>{p.profiles?.full_name||(p.user_id===profile.id?profile.full_name:"Anggota")}</td><td>{p.period}</td><td>{rupiah(p.amount)}</td><td>{p.proof_path?<ProofLink path={p.proof_path}/>: "—"}</td><td><Status value={p.status}/></td>{canManage&&<td>{p.status==="pending"&&<div className="actions"><button className="approve" onClick={()=>decide(p,"approved")} title="Setujui"><Check size={16}/></button><button className="reject" onClick={()=>decide(p,"rejected")} title="Tolak"><X size={16}/></button></div>}</td>}</tr>)}</tbody></table>{!visible.length&&<Empty text="Belum ada pembayaran."/>}</div></section></div>;
}
function ProofLink({path}:{path:string}) {const [url,setUrl]=useState("");useEffect(()=>{supabase.storage.from("payment-proofs").createSignedUrl(path,300).then(({data})=>setUrl(data?.signedUrl||""))},[path]);return url?<a href={url} target="_blank" rel="noreferrer">Lihat bukti</a>:<span className="muted">Memuat…</span>}
function Transactions({transactions,canManage,refresh,notify}:{transactions:CashTransaction[];canManage:boolean;refresh:()=>void;notify:(s:string)=>void}) {
  const [title,setTitle]=useState("");const [type,setType]=useState<"income"|"expense">("income");const [amount,setAmount]=useState("");const [desc,setDesc]=useState("");const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  async function submit(e:React.FormEvent){e.preventDefault();const {error}=await supabase.from("cash_transactions").insert({title,type,amount:Number(amount),description:desc||null,transaction_date:date});if(error)notify(error.message);else{notify("Transaksi berhasil disimpan.");setTitle("");setAmount("");setDesc("");refresh();}}
  return <div className="stack">{canManage&&<form className="panel form-grid" onSubmit={submit}><div className="panel-head full-span"><div><h3>Tambah transaksi</h3><p>Catat pemasukan atau pengeluaran kas kelas.</p></div></div><label>Jenis<select value={type} onChange={e=>setType(e.target.value as "income"|"expense")}><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></select></label><label>Nominal (Rp)<input required min="1" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="25000"/></label><label>Judul transaksi<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Kas bulan November"/></label><label>Tanggal<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="full-span">Keterangan<input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Keterangan tambahan (opsional)"/></label><button className="primary">Simpan transaksi</button></form>}{!canManage&&<div className="notice">Mode anggota: kamu dapat melihat transaksi, tetapi tidak dapat menambah atau mengubahnya.</div>}<section className="panel"><div className="panel-head"><div><h3>Seluruh transaksi</h3><p>Daftar transaksi yang tercatat di database.</p></div></div><TransactionTable transactions={transactions}/></section></div>;
}
function TransactionTable({transactions}:{transactions:CashTransaction[]}) {return <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Transaksi</th><th>Jenis</th><th>Nominal</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>{dateLabel(t.transaction_date)}</td><td><b>{t.title}</b><small className="subline">{t.description}</small></td><td><span className={t.type==="income"?"income-tag":"expense-tag"}>{t.type==="income"?"Pemasukan":"Pengeluaran"}</span></td><td className="amount">{t.type==="income"?"+":"−"}{rupiah(Number(t.amount))}</td></tr>)}</tbody></table>{!transactions.length&&<Empty text="Belum ada transaksi."/>}</div>}
function Reports({transactions,payments,balance}:{transactions:CashTransaction[];payments:Payment[];balance:number}) {return <section className="panel"><div className="panel-head"><div><h3>Laporan keuangan</h3><p>Ringkasan berdasarkan data yang tersimpan di Supabase.</p></div><button className="secondary" onClick={()=>window.print()}><FileText size={16}/> Cetak / Simpan PDF</button></div><div className="report-summary"><div><span>Saldo akhir</span><b>{rupiah(balance)}</b></div><div><span>Jumlah transaksi</span><b>{transactions.length}</b></div><div><span>Pembayaran disetujui</span><b>{payments.filter(p=>p.status==="approved").length}</b></div></div><TransactionTable transactions={transactions}/><p className="muted small print-note">Pilih “Save as PDF” pada dialog cetak browser untuk menyimpan laporan.</p></section>}
function Status({value}:{value:Payment["status"]}) {return <span className={`status ${value}`}>{value==="approved"?"Disetujui":value==="rejected"?"Ditolak":"Menunggu"}</span>}
function Empty({text}:{text:string}) {return <div className="empty">{text}</div>}
function roleLabel(role:Role) {return role==="admin"?"Admin":role==="bendahara"?"Bendahara":"Anggota";}