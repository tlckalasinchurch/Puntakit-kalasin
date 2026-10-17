import { MapPinOff, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { cn } from "@/lib/utils";

/**
 * Shown instead of the map when the device or WebView cannot do WebGL. The list view
 * and every other part of the page keep working; this gives people a way to still see
 * the place in Google Maps.
 */
export function MapUnavailable({ className, target }: { className?: string; target?: { lat: number; lng: number } | null }) {
  const href = target
    ? `https://www.google.com/maps/search/?api=1&query=${target.lat.toFixed(6)},${target.lng.toFixed(6)}`
    : "https://www.google.com/maps/@16.4322,103.5061,11z";
  return (
    <div
      role="status"
      data-testid="map-unavailable"
      className={cn(
        "flex min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-6 py-10 text-center",
        className
      )}
    >
      <MapPinOff size={ICON_SIZE["2xl"]} aria-hidden="true" className="text-[var(--color-body-muted)]" />
      <p className="type-body-strong text-[var(--color-ink)]">เปิดแผนที่ในหน้านี้ไม่ได้</p>
      <p className="type-caption max-w-sm text-[var(--color-body-muted)]">
        เบราว์เซอร์หรือแอปที่คุณใช้อยู่ยังไม่รองรับการแสดงแผนที่ (WebGL) ดูพันธกิจเป็นรายการ หรือเปิดใน Google Maps แทน
      </p>
      <Button asChild variant="outline">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <Navigation aria-hidden="true" />
          เปิดใน Google Maps
        </a>
      </Button>
    </div>
  );
}
