import { Cross, Home } from "lucide-react";
import { useLocation } from "wouter";
import { ICON_SIZE } from "@/lib/icon-sizes";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-canvas-soft)",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "var(--radius-card)",
          boxShadow: "0 10px 40px rgba(23,59,112,.1)",
          border: "1px solid #e4ecf4",
          padding: "48px 40px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "var(--radius-panel)",
            background: "linear-gradient(135deg,#3f7337,#315c2b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            color: "#fff",
            boxShadow: "0 8px 20px rgba(47,111,204,.3)",
          }}
        >
          <Cross size={29} strokeWidth={3.4} />
        </div>

        {/* 404 */}
        <p
          style={{
            fontSize: "72px",
            fontWeight: 800,
            color: "#272729",
            lineHeight: 1,
            margin: "0 0 8px",
            letterSpacing: "-3px",
          }}
        >
          404
        </p>

        <h1
          style={{
            fontSize: "20px",
            color: "#17324d",
            margin: "0 0 10px",
            fontWeight: 700,
          }}
        >
          ไม่พบหน้าที่ต้องการ
        </h1>

        <p
          style={{
            fontSize: "13px",
            color: "#6b7c93",
            lineHeight: 1.7,
            margin: "0 0 32px",
          }}
        >
          หน้าที่คุณกำลังมองหาอาจถูกย้ายหรือลบออกแล้ว
          <br />
          กรุณากลับสู่หน้าหลัก
        </p>

        <button
          onClick={() => setLocation("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#315c2b",
            color: "#fff",
            borderRadius: "12px",
            padding: "11px 20px",
            fontSize: "13px",
            fontWeight: 600,
            border: 0,
            cursor: "pointer",
            boxShadow: "0 7px 18px rgba(47,111,204,.25)",
            transition: ".2s",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "#235cb0")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "#315c2b")
          }
        >
          <Home size={ICON_SIZE.sm} />
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}
