import { Heart, MapPin, MessageCircle, MoreHorizontal, Users } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

export type MissionPostData = {
  id: string;
  group: string;
  area: string;
  time: string;
  location: string;
  summary: string;
  participants: number;
  newPeople: string[];
  topic: string;
  prayer?: string;
  images: string[];
  reactions: { prayer: number; love: number; celebrate: number };
};

const placeholderImages = [
  "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80",
];

export const missionPosts: MissionPostData[] = [
  {
    id: "mission-001",
    group: "เมือง 1",
    area: "อำเภอเมืองกาฬสินธุ์",
    time: "2 ชั่วโมงที่แล้ว",
    location: "บ้านพี่สมชาย",
    summary: "วันนี้กลุ่มเราเจอกันที่บ้านพี่สมชาย มีทั้งคนเดิมและคนใหม่ เราคุยเรื่องการให้อภัยและอธิษฐานเผื่อครอบครัวน้องโจ",
    participants: 14,
    newPeople: ["พี่แดง", "น้องโจ"],
    topic: "การให้อภัย",
    prayer: "อธิษฐานเผื่อครอบครัวน้องโจ",
    images: placeholderImages,
    reactions: { prayer: 12, love: 8, celebrate: 5 },
  },
  {
    id: "mission-002",
    group: "สมเด็จ",
    area: "อำเภอสมเด็จ",
    time: "5 ชั่วโมงที่แล้ว",
    location: "บ้านพี่วิชัย",
    summary: "สมาชิกกลับมาร่วมกลุ่มต่อเนื่อง มีการแบ่งปันพระคำและอธิษฐานร่วมกัน พร้อมต้อนรับผู้เข้าร่วมใหม่หนึ่งคน",
    participants: 21,
    newPeople: ["น้องพลอย"],
    topic: "ความเชื่อที่ลงมือทำ",
    images: [
      placeholderImages[1],
      placeholderImages[0],
    ],
    reactions: { prayer: 9, love: 6, celebrate: 7 },
  },
  {
    id: "mission-003",
    group: "ท่าคันโท",
    area: "อำเภอท่าคันโท",
    time: "เมื่อวาน",
    location: "บ้านคุณนา",
    summary: "กลุ่มพบปะและอธิษฐานร่วมกัน มีการติดตามสมาชิกที่ห่างหาย และวางแผนเยี่ยมบ้านในสัปดาห์หน้า",
    participants: 9,
    newPeople: [],
    topic: "การดูแลกัน",
    images: [placeholderImages[1]],
    reactions: { prayer: 6, love: 4, celebrate: 2 },
  },
  {
    id: "mission-004",
    group: "คำใหญ่",
    area: "อำเภอห้วยผึ้ง",
    time: "2 วันที่แล้ว",
    location: "บ้านพี่มนัส",
    summary: "รายงานล่าสุดของกลุ่มคำใหญ่ ระบบพบว่ามีการพบปะและมีรูปกิจกรรม แต่จำนวนผู้เข้าร่วมยังไม่ชัดเจน",
    participants: 0,
    newPeople: [],
    topic: "รอตรวจสอบจำนวนผู้เข้าร่วม",
    images: [placeholderImages[2]],
    reactions: { prayer: 3, love: 2, celebrate: 1 },
  },
];

export function MissionPost({ post }: { post: MissionPostData }) {
  const imageCount = post.images.length;

  return (
    <article className="mission-post card-surface">
      <header className="mission-post-header">
        <div className="mission-group-avatar">{post.group.slice(0, 1)}</div>
        <div className="mission-post-identity">
          <strong>{post.group}</strong>
          <span>{post.area} · {post.time}</span>
        </div>
        <button className="mission-icon-button" aria-label="เมนูโพสต์">
          <MoreHorizontal size={ICON_SIZE.md} />
        </button>
      </header>

      <div className="mission-post-body">
        <div className="mission-location">
          <MapPin size={ICON_SIZE.sm} />
          <span>{post.location}</span>
        </div>
        <p>{post.summary}</p>

        <div className="mission-metrics">
          <div className="mission-metric">
            <Users size={ICON_SIZE.sm} />
            <span>ผู้เข้าร่วม</span>
            <strong>{post.participants > 0 ? post.participants : "—"}</strong>
          </div>
          <div className="mission-metric new">
            <span className="mission-metric-dot">+</span>
            <span>คนใหม่</span>
            <strong>{post.newPeople.length}</strong>
          </div>
          <div className="mission-metric topic">
            <span className="mission-topic-mark">◈</span>
            <span>หัวข้อ</span>
            <strong>{post.topic}</strong>
          </div>
        </div>

        {post.newPeople.length > 0 && (
          <div className="mission-new-people">
            <span>🆕 คนใหม่</span>
            <div>
              {post.newPeople.map((person) => (
                <b key={person}>{person}</b>
              ))}
            </div>
          </div>
        )}

        {post.prayer && (
          <div className="mission-prayer">
            <span>🙏</span>
            <div>
              <small>คำอธิษฐาน</small>
              <strong>{post.prayer}</strong>
            </div>
          </div>
        )}

        <div className={"mission-photo-grid photos-" + Math.min(imageCount, 3)}>
          {post.images.slice(0, 3).map((image, index) => (
            <img key={image} src={image} alt={"ภาพกิจกรรม " + post.group + " " + (index + 1)} />
          ))}
          {imageCount > 3 && <span className="mission-photo-more">+{imageCount - 3}</span>}
        </div>
      </div>

      <footer className="mission-post-footer">
        <span>🙏 {post.reactions.prayer}</span>
        <span><Heart size={ICON_SIZE.xs} /> {post.reactions.love}</span>
        <span>👏 {post.reactions.celebrate}</span>
        <span className="mission-comment"><MessageCircle size={ICON_SIZE.xs} /> 2</span>
      </footer>
    </article>
  );
}
