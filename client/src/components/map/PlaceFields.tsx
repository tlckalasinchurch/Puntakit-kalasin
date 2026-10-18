import { GroupPhotoField } from "@/components/groups/GroupPhotoField";
import type { PlaceDraft } from "@/lib/placeDraft";

const INPUT =
  "h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

interface PlaceFieldsProps {
  group: { id: string; name: string; coverUrl: string | null };
  draft: PlaceDraft;
  onChange: (next: PlaceDraft) => void;
  /** Called with the new stored photo URL, or null when it was removed. */
  onPhotoChange: (url: string | null) => void;
}

/**
 * The place photo and the landmark / meeting details of a group, shown inside the map's location
 * dialog so they are edited next to the pin. The text is saved together with the coordinates by
 * one PUT; the photo is a separate upload and is stored as soon as it is chosen. Rendered only for
 * people who may edit the group, so the photo controls are always on.
 */
export function PlaceFields({ group, draft, onChange, onPhotoChange }: PlaceFieldsProps) {
  const set = (key: keyof PlaceDraft) => (value: string) => onChange({ ...draft, [key]: value });
  return (
    <div className="space-y-4 border-t border-[var(--color-hairline)] pt-4">
      <div>
        <p className="type-caption-strong mb-2 text-[var(--color-ink)]">รูปสถานที่</p>
        <GroupPhotoField groupId={group.id} groupName={group.name} url={group.coverUrl} canEdit onChange={onPhotoChange} />
      </div>
      <label className="block">
        <span className="type-caption-strong mb-1 block text-[var(--color-ink)]">รายละเอียดและจุดสังเกต</span>
        <textarea
          value={draft.description}
          onChange={(event) => set("description")(event.target.value)}
          maxLength={3000}
          rows={3}
          placeholder="เช่น ตรงข้ามร้านค้า ซอยข้างวัด บ้านรั้วสีขาว"
          className={`${INPUT} h-auto py-2`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="type-caption-strong mb-1 block text-[var(--color-ink)]">วันประชุม</span>
          <input value={draft.meetingDay} onChange={(event) => set("meetingDay")(event.target.value)} maxLength={100} placeholder="เช่น ทุกวันพุธ" className={INPUT} />
        </label>
        <label className="block">
          <span className="type-caption-strong mb-1 block text-[var(--color-ink)]">เวลา</span>
          <input value={draft.meetingTime} onChange={(event) => set("meetingTime")(event.target.value)} maxLength={100} placeholder="เช่น 19:00" className={INPUT} />
        </label>
      </div>
      <label className="block">
        <span className="type-caption-strong mb-1 block text-[var(--color-ink)]">สถานที่ประชุม</span>
        <input value={draft.meetingLocation} onChange={(event) => set("meetingLocation")(event.target.value)} maxLength={300} placeholder="เช่น บ้านคุณสมชาย" className={INPUT} />
      </label>
    </div>
  );
}
