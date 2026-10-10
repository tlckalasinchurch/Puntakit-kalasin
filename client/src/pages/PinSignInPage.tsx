import { useEffect, useState } from "react";
import { Delete, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LegalLinks } from "@/components/LegalLinks";
const digits = ["1","2","3","4","5","6","7","8","9","0"];
export default function PinSignInPage() {
  usePageTitle("เข้าสู่ระบบ");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [identity, setIdentity] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (user) navigate(user.role === "member" ? "/app" : "/"); }, [user, navigate]);
  const append = (value: string) => { if (pin.length < 6) { setPin(v => v + value); setError(""); } };
  const submit = async () => {
    if (busy || pin.length !== 6 || !identity.trim()) return;
    setBusy(true); setError("");
    try { await api.post("/api/auth/login", { identity, pin }); window.location.assign("/"); }
    catch (err) { setPin(""); setError(err instanceof ApiError ? (err.serverMessage ?? err.message) : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  };
  return <main className="pin-login" onKeyDown={e => { if (/^\d$/.test(e.key)) append(e.key); if (e.key === "Backspace") setPin(v => v.slice(0,-1)); if (e.key === "Enter") void submit(); }}>
    <section className="pin-login__brand"><Logo tone="onDark" /><p className="type-display-md">ระบบดูแลสมาชิกและพันธกิจ</p><p className="type-body">คริสตจักรชีวิตสุขสันต์กาฬสินธุ์</p></section>
    <section className="pin-login__panel" aria-labelledby="login-title"><div className="pin-login__card"><div className="pin-login__mobile-logo"><Logo tone="onLight" /></div><h1 id="login-title" className="type-display-md">เข้าสู่ระบบ</h1><p className="type-body pin-login__sub">กรุณากรอกรหัส PIN เพื่อดำเนินการต่อ</p>
      <label className="pin-login__identity">อีเมลบัญชีผู้ใช้<input type="email" autoComplete="username" value={identity} onChange={e => setIdentity(e.target.value)} placeholder="name@example.com" /></label>
      <div className="pin-login__dots" aria-label={`กรอก PIN แล้ว ${pin.length} จาก 6 หลัก`}>{Array.from({length:6}, (_,i) => <span key={i} className={i < pin.length ? "is-filled" : ""} />)}</div>
      <div className="pin-login__keypad" aria-label="แป้นตัวเลข">{digits.slice(0,9).map(d => <button key={d} type="button" onClick={() => append(d)} aria-label={`เลข ${d}`} disabled={busy}>{d}</button>)}<span /><button type="button" onClick={() => append("0")} aria-label="เลข 0" disabled={busy}>0</button><button type="button" onClick={() => setPin(v => v.slice(0,-1))} aria-label="ลบตัวเลข" disabled={busy}><Delete size={22} /></button></div>
      <button type="button" className="pin-login__submit" disabled={busy || pin.length !== 6 || !identity.trim()} onClick={() => void submit()}><ShieldCheck size={19} />{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
      {error && <p className="pin-login__error" role="alert">{error}</p>}<p className="type-caption pin-login__help">หากลืม PIN กรุณาติดต่อผู้ดูแลระบบเพื่อยืนยันตัวตนและเปิดการลงทะเบียนใหม่</p><LegalLinks />
    </div></section>
  </main>;
}
