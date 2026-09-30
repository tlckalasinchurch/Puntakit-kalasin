import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "wouter";

const sections = [
  {
    title: "1. การยอมรับข้อกำหนด",
    body: [
      "การเข้าใช้งานระบบ Puntakit ถือว่าคุณยอมรับเงื่อนไขการใช้งานฉบับนี้ หากไม่เห็นด้วย กรุณาอย่าใช้งานระบบ ผู้ดูแลระบบอาจปรับปรุงเงื่อนไขนี้และจะแจ้งให้สมาชิกทราบเมื่อมีการเปลี่ยนแปลงสำคัญ",
    ],
  },
  {
    title: "2. วัตถุประสงค์ของระบบ",
    body: [
      "ระบบจัดทำขึ้นเพื่อการดูแลสมาชิกคริสตจักรพันธกิจกาฬสินธุ์ เช่น การจัดการรายชื่อสมาชิก กลุ่มแคร์ การบันทึกการเข้าร่วมนมัสการ การแจ้งเตือนประกาศและกิจกรรม รวมถึงแอปสำหรับสมาชิก (PWA) เพื่อความสะดวกในการติดตามข่าวสารและการลงทะเบียนกิจกรรม",
    ],
  },
  {
    title: "3. สิทธิและการรับผิดชอบของผู้ใช้",
    body: [
      "คุณต้องใช้ข้อมูลจริงของตนเองในการสมัครและเข้าสู่ระบบ ห้ามแชร์บัญชีของตนให้ผู้อื่นใช้งานแทน ผู้ใช้ต้องรักษาความลับของรหัสผ่าน และรับผิดชอบต่อการกระทำที่ทำผ่านบัญชีของตน การเข้าถึงข้อมูลสมาชิกคนอื่นต้องเป็นไปตามสิทธิ์บทบาท (RBAC) ที่ระบบกำหนดเท่านั้น",
    ],
  },
  {
    title: "4. การใช้ข้อมูลและความเป็นส่วนตัว",
    body: [
      "รายละเอียดการเก็บ ใช้ และคุ้มครองข้อมูลส่วนบุคคล ระบุไว้ใน",
      "นโยบายความเป็นส่วนตัว",
      "ซึ่งเป็นส่วนหนึ่งที่แยกอ่านได้จากหน้านี้ การใช้งานระบบย่อมหมายถึงการยอมรับนโยบายความเป็นส่วนตัวดังกล่าวด้วย",
    ],
  },
  {
    title: "5. การใช้รูปภาพและพิกัด",
    body: [
      "รูปภาพและพิกัดที่สมาชิกเพิ่มเข้ามา (เช่น รูปโปรไฟล์ สถานที่จัดกิจกรรม) จะใช้แสดงในระบบเท่านั้น ห้ามนำไปเผยแพร่หรือใช้นอกวัตถุประสงค์ของคริสตจักร",
    ],
  },
  {
    title: "6. การระงับหรือเพิกถอนสิทธิ์",
    body: [
      "ผู้ดูแลระบบสามารถระงับบัญชีที่ใช้งานในทางที่ไม่เหมาะสม แจ้งข้อมูลเท็จ หรือละเมิดสิทธิ์ผู้อื่นได้ สมาชิกสามารถขอยกเลิกการใช้งานและขอลบข้อมูลของตนตามช่องทางในนโยบายความเป็นส่วนตัว",
    ],
  },
  {
    title: "7. ช่องทางติดต่อ",
    body: [
      "หากมีคำถามเกี่ยวกับเงื่อนไขการใช้งาน ติดต่อผู้ดูแลระบบของคริสตจักรพันธกิจกาฬสินธุ์ผ่านอีเมลหรือช่องทางติดต่อที่ระบุบนเว็บไซต์ของคริสตจักร",
    ],
  },
];

export default function Terms() {
  return (
    <div className="login-shell" style={{ alignItems: "flex-start", overflowY: "auto", padding: "32px 16px" }}>
      <article
        className="login-card"
        style={{ width: "min(760px, 100%)", textAlign: "left", maxHeight: "none" }}
        data-testid="terms-page"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <FileText size={20} style={{ color: "var(--blue)" }} />
          <h1 style={{ margin: 0, fontSize: 24 }}>เงื่อนไขการใช้งานระบบ</h1>
        </div>
        <p className="login-sub" style={{ marginTop: 0 }}>
          กรุณาอ่านเงื่อนไขการใช้งานนี้ก่อนใช้ระบบ Puntakit เพื่อให้เข้าใจสิทธิและความรับผิดชอบของคุณ
        </p>

        {sections.map((s) => (
          <section key={s.title} style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16, margin: "0 0 8px", color: "var(--navy)" }}>{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "var(--muted)", margin: "0 0 8px" }}>
                {s.title.startsWith("4.") && i === 1 ? (
                  <Link href="/privacy" style={{ color: "var(--blue)", fontWeight: 600 }}>
                    {p}
                  </Link>
                ) : (
                  p
                )}
              </p>
            ))}
          </section>
        ))}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
          <Link
            href="/privacy"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--blue)", textDecoration: "none", marginRight: 20 }}
          >
            อ่านนโยบายความเป็นส่วนตัว →
          </Link>
          <Link
            href="/login"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <ArrowLeft size={14} /> กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </article>
    </div>
  );
}
