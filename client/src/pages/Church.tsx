import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { FormSkeleton } from "@/components/LoadingStates";
import {
  ErrorState,
  Field,
  PageHeader,
} from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ADMIN_ROLES, hasRole } from "@shared/roles";

interface ChurchProfile {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  updatedAt: string;
}

const EMPTY_FORM = { name: "", address: "", phone: "", email: "", description: "" };

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:cursor-not-allowed disabled:bg-[var(--color-canvas-soft)] disabled:text-[var(--color-body-muted)]";

export default function Church() {
  const { user } = useAuth();
  // Mirrors the server's `requireAdmin` on PUT /api/church-profile
  // (shared/roles.ts ADMIN_ROLES).
  const isAdmin = hasRole(user?.role, ADMIN_ROLES);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    setError(null);
    api
      .get<ChurchProfile | null>("/api/church-profile")
      .then((data) => {
        if (data) {
          setForm({
            name: data.name,
            address: data.address ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
            description: data.description ?? "",
          });
          setUpdatedAt(data.updatedAt);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api.put<ChurchProfile>("/api/church-profile", form);
      setUpdatedAt(saved.updatedAt);
      toast.success("บันทึกข้อมูลคริสตจักรแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="ข้อมูลคริสตจักร"
        description="ข้อมูลพื้นฐานของคริสตจักรที่แสดงต่อสมาชิกและผู้เยี่ยมชม"
      />

      <section className="card-surface max-w-3xl p-5 sm:p-8">
        {isLoading ? (
          <FormSkeleton fields={5} />
        ) : error ? (
          <ErrorState technical={error} onRetry={load} />
        ) : (
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <Field label="ชื่อคริสตจักร" required>
              {(props) => (
                <input
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  aria-invalid={props["aria-invalid"]}
                  required
                  disabled={!isAdmin}
                  className={CONTROL_CLASS}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="เบอร์โทรศัพท์">
                {(props) => (
                  <input
                    id={props.id}
                    aria-describedby={props["aria-describedby"]}
                    aria-invalid={props["aria-invalid"]}
                    type="tel"
                    disabled={!isAdmin}
                    className={CONTROL_CLASS}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                )}
              </Field>
              <Field label="อีเมล">
                {(props) => (
                  <input
                    id={props.id}
                    aria-describedby={props["aria-describedby"]}
                    aria-invalid={props["aria-invalid"]}
                    type="email"
                    disabled={!isAdmin}
                    className={CONTROL_CLASS}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                )}
              </Field>
            </div>

            <Field label="ที่อยู่คริสตจักร">
              {(props) => (
                <input
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  aria-invalid={props["aria-invalid"]}
                  disabled={!isAdmin}
                  className={CONTROL_CLASS}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              )}
            </Field>

            <Field label="รายละเอียดเกี่ยวกับคริสตจักร">
              {(props) => (
                <textarea
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  aria-invalid={props["aria-invalid"]}
                  rows={5}
                  disabled={!isAdmin}
                  className={CONTROL_CLASS}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              )}
            </Field>

            {updatedAt && (
              <p className="type-fine flex items-center gap-1.5 pt-1 text-[var(--color-body-muted)]">
                <Building2 size={ICON_SIZE.xs} aria-hidden="true" />
                <span>อัปเดตล่าสุด: {new Date(updatedAt).toLocaleString("th-TH")}</span>
              </p>
            )}

            {isAdmin && (
              <div className="flex justify-end border-t border-[var(--color-divider)] pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
                >
                  <Save size={ICON_SIZE.sm} aria-hidden="true" />
                  <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
                </button>
              </div>
            )}
          </form>
        )}
      </section>
    </AppLayout>
  );
}
