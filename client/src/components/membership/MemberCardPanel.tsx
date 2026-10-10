import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Printer, Hash } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/DesignSystem";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ACCEPTED_IMAGE_TYPES, ImageUploadError, prepareImage, uploadMemberAvatar } from "@/lib/imageUpload";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { MEMBER_UPDATE_ROLES, hasRole } from "@shared/roles";
import type { MembershipType } from "@shared/membership";
import { MemberCard, type MemberCardData } from "./MemberCard";

interface CardResponse extends Omit<MemberCardData, "membership"> {
  id: string;
  membership: { type: MembershipType | null; state: string; label: string; endsOn: string | null } | null;
  canAssignNumber: boolean;
}

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

/**
 * The member's card, read live from the register, with the actions that belong
 * to it: change the photo (resized in the browser, stored privately), print
 * the card at ID-1 size, and give the member a card number.
 */
export function MemberCardPanel({ memberId, onChanged }: { memberId: string; onChanged?: () => void }) {
  const { user } = useAuth();
  const [card, setCard] = useState<CardResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<"photo" | "number" | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const canEditPhoto = hasRole(user?.role, MEMBER_UPDATE_ROLES);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCard(await api.get<CardResponse>(`/api/member-cards/${memberId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("โหลดบัตรสมาชิกไม่สำเร็จ", 0));
    }
  }, [memberId]);

  useEffect(() => {
    setCard(null);
    void load();
  }, [load]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy("photo");
    try {
      // Portrait 4:5 to match the card's photo frame; 900px on the long edge is sharp when printed.
      const image = await prepareImage(file, { maxEdge: 1000, aspect: 4 / 5, quality: 0.85 });
      await uploadMemberAvatar(memberId, image);
      toast.success("เปลี่ยนรูปสมาชิกแล้ว");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ImageUploadError || err instanceof ApiError ? err.message : "อัปโหลดรูปไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(null);
      if (pickRef.current) pickRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const assignNumber = async () => {
    setBusy("number");
    try {
      const res = await api.post<{ memberNo: string }>(`/api/member-cards/${memberId}/number`, {});
      toast.success(`กำหนดหมายเลขสมาชิก ${res.memberNo} แล้ว`);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "กำหนดหมายเลขไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const print = () => {
    document.body.classList.add("pk-printing-card");
    const done = () => {
      document.body.classList.remove("pk-printing-card");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  if (error) {
    return <ErrorState inset title="โหลดบัตรสมาชิกไม่สำเร็จ" description={error.message} technical={error.serverMessage} onRetry={() => void load()} />;
  }
  if (!card) {
    return (
      <div role="status" aria-label="กำลังโหลดบัตรสมาชิก">
        <Skeleton className="aspect-[1.586] w-full max-w-[640px] rounded-[var(--radius-lg)]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MemberCard card={card} />
      <div className="flex flex-wrap items-center gap-2">
        {canEditPhoto && (
          <>
            <input ref={pickRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
            <input ref={cameraRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
            <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => pickRef.current?.click()}>
              <ImagePlus size={ICON_SIZE.sm} aria-hidden="true" />
              {busy === "photo" ? "กำลังอัปโหลด…" : card.avatarUrl ? "เปลี่ยนรูป" : "เพิ่มรูป"}
            </button>
            <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => cameraRef.current?.click()}>
              <Camera size={ICON_SIZE.sm} aria-hidden="true" />
              ถ่ายรูป
            </button>
          </>
        )}
        {card.canAssignNumber && !card.memberNo && (
          <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => void assignNumber()}>
            <Hash size={ICON_SIZE.sm} aria-hidden="true" />
            {busy === "number" ? "กำลังกำหนด…" : "กำหนดหมายเลขสมาชิก"}
          </button>
        )}
        <button type="button" className={BUTTON} onClick={print}>
          <Printer size={ICON_SIZE.sm} aria-hidden="true" />
          พิมพ์บัตร
        </button>
      </div>
      {!card.memberNo && <p className="type-fine text-[var(--color-body-muted)]">ยังไม่มีหมายเลขสมาชิก — บัตรจะแสดง “No. —” จนกว่าเจ้าหน้าที่จะกำหนดหมายเลข</p>}
    </div>
  );
}
