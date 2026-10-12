/**
 * Puntakit Lamb mascot — consistent friendly lamb character.
 * Poses: map (hero), welcome (invite), support (help), clipboard (reports).
 */

export type LambPose = "map" | "welcome" | "support" | "clipboard";

const POSE_SRC: Record<LambPose, string> = {
  map: "/lamb/lamb-map.webp",
  welcome: "/lamb/lamb-welcome.webp",
  support: "/lamb/lamb-support.webp",
  clipboard: "/lamb/lamb-clipboard.webp",
};

const POSE_ALT: Record<LambPose, string> = {
  map: "มาสคอตลูกแกะถือแผนที่",
  welcome: "มาสคอตลูกแกะทักทาย",
  support: "มาสคอตลูกแกะช่วยเหลือ",
  clipboard: "มาสคอตลูกแกะถือคลิปบอร์ด",
};

export function LambMascot({
  pose,
  className = "",
}: {
  pose: LambPose;
  className?: string;
}) {
  return (
    <img
      src={POSE_SRC[pose]}
      alt={POSE_ALT[pose]}
      className={className}
      loading="lazy"
      draggable={false}
    />
  );
}
