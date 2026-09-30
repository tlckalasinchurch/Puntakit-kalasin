import { useEffect, useState } from "react";
import { AlertCircle, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { FormSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";

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

export default function Church() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

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
      {/* Page Heading */}
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
          CHURCH PROFILE • ข้อมูลคริสตจักร
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          ข้อมูลคริสตจักร
        </h1>
        <p className="text-xs text-slate-500">
          ข้อมูลพื้นฐานของคริสตจักรที่แสดงต่อสมาชิกและผู้เยี่ยมชม
        </p>
      </div>

      <section className="tailadmin-card p-6 sm:p-8 max-w-3xl">
        {isLoading ? (
          <FormSkeleton fields={5} />
        ) : error ? (
          <div className="p-10 text-center text-rose-600">
            <AlertCircle size={ICON_SIZE.xl} className="mx-auto mb-2 text-rose-500" />
            <h3 className="font-bold text-sm">โหลดข้อมูลไม่สำเร็จ</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              className="mt-4 rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100"
              onClick={load}
            >
              ลองใหม่
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                ชื่อคริสตจักร *
              </label>
              <input
                required
                disabled={!isAdmin}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  เบอร์โทรศัพท์
                </label>
                <input
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  อีเมล
                </label>
                <input
                  type="email"
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                ที่อยู่คริสตจักร
              </label>
              <input
                disabled={!isAdmin}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                รายละเอียดเกี่ยวกับคริสตจักร
              </label>
              <textarea
                rows={5}
                disabled={!isAdmin}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {updatedAt && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-2">
                <Building2 size={ICON_SIZE.xs} />
                <span>อัปเดตล่าสุด: {new Date(updatedAt).toLocaleString("th-TH")}</span>
              </div>
            )}

            {isAdmin && (
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Save size={ICON_SIZE.sm} />
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
