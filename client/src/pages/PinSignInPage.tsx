import { useEffect, useState, type KeyboardEvent } from "react";
import { BarChart3, CalendarCheck, Delete, MapPin, RotateCcw, ShieldCheck, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LegalLinks } from "@/components/LegalLinks";

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/** What the product does, in the church's own words — one per real area of the app. */
const FEATURES = [
  { icon: Users, label: "จัดการสมาชิกและทีม" },
  { icon: CalendarCheck, label: "ติดตามกิจกรรมและการรับใช้" },
  { icon: BarChart3, label: "เห็นภาพรวมด้วยข้อมูล" },
  { icon: MapPin, label: "เชื่อมโยงชุมชนบนแผนที่" },
];

/** The Puntakit mark. The file is a JPG on white, so it always sits on a white plate. */
function LogoPlate({ size }: { size: number }) {
  return (
    <span className="pin-login__plate" style={{ width: size, height: size }}>
      <img src="/puntakit-logo.jpg" alt="โลโก้ Puntakit" width={size} height={size} decoding="async" />
    </span>
  );
}

export default function PinSignInPage() {
  usePageTitle("เข้าสู่ระบบ");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate(user.role === "member" ? "/app" : "/");
  }, [user, navigate]);

  const append = (value: string) => {
    if (pin.length < 6) {
      setPin((current) => current + value);
      setError("");
    }
  };

  const clearPin = () => {
    setPin("");
    setError("");
  };

  const submit = async () => {
    if (busy || pin.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/api/auth/login", { pin });
      // A full reload, deliberately: the session cookie was just issued and
      // AuthContext still holds a null user, so a client-side navigate would
      // bounce straight back to /login.
      window.location.assign("/");
    } catch (err) {
      setPin("");
      setError(
        err instanceof ApiError
          ? (err.serverMessage ?? err.message)
          : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      append(event.key);
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      setPin((current) => current.slice(0, -1));
    }
    if (event.key === "Escape") {
      event.preventDefault();
      clearPin();
    }
    if (event.key === "Enter") void submit();
  };

  return (
    <main className="pin-login" onKeyDown={handleKeyDown}>
      <section className="pin-login__brand" aria-label="เกี่ยวกับ Puntakit">
        <div className="pin-login__brand-content">
          <div className="pin-login__brand-head">
            <LogoPlate size={132} />
            <p className="pin-login__wordmark">Puntakit</p>
            <p className="pin-login__church">คริสตจักรชีวิตสุขสันต์กาฬสินธุ์</p>
          </div>

          <div className="pin-login__brand-copy">
            <p className="type-display-md">
              ร่วมกันดูแล
              <br />
              คนและชุมชน
            </p>
            <p className="type-body">
              เชื่อมต่อทีม ติดตามการรับใช้
              <br />
              สร้างผลกระทบจริงในจังหวัดกาฬสินธุ์
            </p>
          </div>

          <ul className="pin-login__features">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <div className="pin-login__brand-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>ข้อมูลของคุณปลอดภัยและเป็นส่วนตัว</span>
          </div>
        </div>
      </section>

      <section className="pin-login__panel" aria-labelledby="login-title">
        <div className="pin-login__card">
          <div className="pin-login__mobile-logo">
            <LogoPlate size={88} />
          </div>

          <div className="pin-login__heading">
            <p className="pin-login__eyebrow">ยินดีต้อนรับกลับ</p>
            <h1 id="login-title">เข้าสู่ระบบ</h1>
            <p className="type-body pin-login__sub">กรอกรหัส PIN เพื่อเข้าสู่ระบบ Puntakit</p>
          </div>

          <div className="pin-login__pin-heading">
            <span>รหัส PIN</span>
            <span className="pin-login__pin-count" aria-live="polite">
              {pin.length}/6
            </span>
          </div>

          <div
            className="pin-login__dots"
            role="img"
            aria-label={`กรอก PIN แล้ว ${pin.length} หลัก จากทั้งหมด 6 หลัก`}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <span
                key={index}
                className={index < pin.length ? "is-filled" : ""}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="pin-login__keypad" role="group" aria-label="แป้นตัวเลข">
            {digits.slice(0, 9).map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => append(digit)}
                aria-label={`เลข ${digit}`}
                disabled={busy}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={clearPin}
              aria-label="ล้างรหัส PIN ทั้งหมด"
              disabled={busy || pin.length === 0}
            >
              <RotateCcw size={19} aria-hidden="true" />
              <span>ล้าง</span>
            </button>
            <button
              type="button"
              onClick={() => append("0")}
              aria-label="เลข 0"
              disabled={busy}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPin((current) => current.slice(0, -1))}
              aria-label="ลบตัวเลขหลักสุดท้าย"
              disabled={busy || pin.length === 0}
            >
              <Delete size={21} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="pin-login__submit"
            aria-busy={busy}
            disabled={busy || pin.length !== 6}
            onClick={() => void submit()}
          >
            <ShieldCheck size={19} aria-hidden="true" />
            {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
          </button>

          {error && (
            <p className="pin-login__error" role="alert">
              {error}
            </p>
          )}

          <p className="type-caption pin-login__help">
            หากลืม PIN กรุณาติดต่อผู้ดูแลระบบ
          </p>

          <LegalLinks />
        </div>
      </section>
    </main>
  );
}
