import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CalendarDays,
  Download,
  Home as HomeIcon,
  LayoutDashboard,
  LogOut,
  User,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { Logo } from "./Logo";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { isInstallPromptAvailable, promptInstall } from "@/lib/pwa";
import { toast } from "sonner";

interface MemberAppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MemberAppLayout({ children, title }: MemberAppLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [canInstall, setCanInstall] = useState(false);

  const isStaffOrAdmin =
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    user?.role === "staff" ||
    user?.role === "ministry_leader" ||
    user?.role === "group_leader";

  useEffect(() => {
    setCanInstall(isInstallPromptAvailable());
    const handler = () => setCanInstall(true);
    window.addEventListener("pwa-install-ready", handler);
    return () => window.removeEventListener("pwa-install-ready", handler);
  }, []);

  const handleInstallClick = async () => {
    const installed = await promptInstall();
    if (installed) {
      toast.success("ติดตั้งแอปพลิเคชันลงหน้าจอหลักเรียบร้อยแล้ว");
      setCanInstall(false);
    }
  };

  const navItems = [
    { label: "หน้าแรก", path: "/app", icon: HomeIcon },
    { label: "กิจกรรม", path: "/app/events", icon: CalendarDays },
    { label: "กลุ่มแคร์", path: "/app/group", icon: UsersRound },
    { label: "เข้าโบสถ์", path: "/app/attendance", icon: UserCheck },
    { label: "โปรไฟล์", path: "/app/profile", icon: User },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-canvas-soft)",
        display: "flex",
        flexDirection: "column",
        maxWidth: "600px",
        margin: "0 auto",
        position: "relative",
        boxShadow: "0 0 35px rgba(23, 59, 112, 0.08)",
      }}
    >
      {/* Mobile App Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          height: "60px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(220, 232, 245, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => navigate("/app")}>
          <Logo />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {canInstall && (
            <button
              onClick={handleInstallClick}
              style={{
                background: "#eef5fc",
                color: "#1d60a4",
                border: "1px solid #c7ddf2",
                borderRadius: "10px",
                padding: "6px 10px",
                fontSize: "11px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
              }}
            >
              <Download size={13} />
              <span>ติดตั้งแอป</span>
            </button>
          )}

          {isStaffOrAdmin && (
            <button
              onClick={() => navigate("/")}
              title="สลับไปยังแดชบอร์ดเจ้าหน้าที่"
              style={{
                background: "#f0f4f9",
                color: "#4f657d",
                borderRadius: "10px",
                padding: "6px 9px",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
              }}
            >
              <LayoutDashboard size={14} />
              <span style={{ fontSize: "11px" }}>Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          padding: "16px 14px 84px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "600px",
          height: "64px",
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid #e1ecf5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 50,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -4px 18px rgba(25, 62, 110, 0.06)",
        }}
      >
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1,
                background: "transparent",
                border: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                color: isActive ? "#315c2b" : "#71859c",
                cursor: "pointer",
                padding: "6px 0",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  position: "relative",
                  padding: "4px 12px",
                  borderRadius: "14px",
                  background: isActive ? "#eaf2fb" : "transparent",
                  transition: "background 0.2s ease",
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span style={{ fontSize: "10px", fontWeight: isActive ? 700 : 500 }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
