import { useEffect, useState } from "react";
import {
  UsersRound,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Mail,
  HeartHandshake,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { ListSkeleton } from "@/components/LoadingStates";

interface GroupMember {
  id: string;
  memberName: string;
  memberNickname: string | null;
  avatarUrl: string | null;
  role: string;
}

interface CareGroupInfo {
  groupId: string;
  groupName: string;
  category: string;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  description: string | null;
  leaderName: string | null;
  leaderEmail: string | null;
  members: GroupMember[];
}

export default function MemberGroup() {
  const [group, setGroup] = useState<CareGroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroup = async () => {
    try {
      const res = await api.get<CareGroupInfo | null>("/api/me/group");
      setGroup(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "โหลดข้อมูลกลุ่มแคร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchGroup();
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <MemberAppLayout title="กลุ่มแคร์ของฉัน">
      <div className="space-y-4">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-[var(--color-dark-surface-2)] to-[var(--color-dark-surface)] rounded-2xl p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
                <UsersRound size={ICON_SIZE.md} className="text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold">กลุ่มชีวิตและการสามัคคีธรรม</h2>
                <p className="text-xs text-blue-100">ผูกพัน เติบโต และดูแลกันในพระคริสต์</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw
                size={ICON_SIZE.sm}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <ListSkeleton count={2} />
          </div>
        )}

        {/* Empty state: No group assigned */}
        {!loading && !group && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto text-[var(--color-primary)] dark:text-blue-400">
              <HeartHandshake size={ICON_SIZE.xl} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                คุณยังไม่ได้สังกัดกลุ่มแคร์
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                การมีกลุ่มแคร์ช่วยให้คุณมีพี่น้องร่วมอธิษฐานและดูแลกัน หากต้องการเข้าร่วมกลุ่มแคร์ กรุณาติดต่อศิษยาภิบาลหรือฝ่ายต้อนรับของคริสตจักร
              </p>
            </div>
            <div className="pt-2">
              <a
                href="tel:043811800"
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[var(--color-dark-surface)] text-white text-sm font-medium hover:bg-[var(--color-dark-surface-3)] transition-colors"
              >
                <UsersRound size={ICON_SIZE.sm} />
                <span>ติดต่อฝ่ายต้อนรับคริสตจักร</span>
              </a>
            </div>
          </div>
        )}

        {/* Group Details & Members */}
        {!loading && group && (
          <>
            {/* Group Overview Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 mb-1.5">
                    {group.category || "กลุ่มแคร์"}
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {group.groupName}
                  </h3>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {group.description}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 text-sm">
                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
                  <Calendar size={ICON_SIZE.sm} className="text-[var(--color-primary)] dark:text-blue-400 shrink-0" />
                  <span>
                    วันนัดหมาย:{" "}
                    <strong className="font-semibold text-gray-900 dark:text-gray-100">
                      {group.meetingDay || "ตามที่นัดหมาย"}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
                  <Clock size={ICON_SIZE.sm} className="text-[var(--color-primary)] dark:text-blue-400 shrink-0" />
                  <span>
                    เวลา:{" "}
                    <strong className="font-semibold text-gray-900 dark:text-gray-100">
                      {group.meetingTime ? `${group.meetingTime} น.` : "ตามที่นัดหมาย"}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
                  <MapPin size={ICON_SIZE.sm} className="text-[var(--color-primary)] dark:text-blue-400 shrink-0" />
                  <span>
                    สถานที่:{" "}
                    <strong className="font-semibold text-gray-900 dark:text-gray-100">
                      {group.meetingLocation || "คริสตจักร / ออนไลน์"}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Group Leader Subcard */}
              {group.leaderName && (
                <div className="mt-3 p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-dark-surface)] text-white flex items-center justify-center font-bold text-sm">
                      {getInitials(group.leaderName)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {group.leaderName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                          หัวหน้ากลุ่ม
                        </span>
                      </div>
                      {group.leaderEmail && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1 mt-0.5">
                          <Mail size={12} />
                          <span>{group.leaderEmail}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fellow Members List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserCheck size={ICON_SIZE.sm} className="text-[var(--color-primary)] dark:text-blue-400" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    สมาชิกในกลุ่ม
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {group.members.length} คน
                </span>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {group.members.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center space-x-3">
                      {m.avatarUrl ? (
                        <img
                          src={m.avatarUrl}
                          alt={m.memberName}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[var(--color-primary)] dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                          {getInitials(m.memberName)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {m.memberName}
                          </p>
                          {m.memberNickname && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({m.memberNickname})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 capitalize">
                          {m.role === "leader" ? "ผู้นำกลุ่ม" : m.role === "assistant" ? "ผู้ช่วยผู้นำ" : "สมาชิก"}
                        </span>
                      </div>
                    </div>

                    {m.role === "leader" && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        ผู้นำ
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* PDPA Privacy Protection Notice */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60 flex items-start space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <ShieldCheck size={ICON_SIZE.sm} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <span>
                  เพื่อความปลอดภัยและปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) ระบบจะแสดงเฉพาะชื่อและชื่อเล่นของสมาชิกในกลุ่ม โดยไม่เปิดเผยเบอร์โทรศัพท์หรือที่อยู่แก่ผู้อื่น
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </MemberAppLayout>
  );
}
