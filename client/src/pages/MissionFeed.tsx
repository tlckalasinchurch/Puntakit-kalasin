import { useMemo, useState } from "react";
import { Bell, Filter, MapPin, Plus, Search, Sparkles, Users, X } from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { MissionPost, missionPosts } from "@/components/mission/MissionPost";
import { MovementCard } from "@/components/mission/MovementCard";
import "@/styles/mission-feed.css";

const filters = [
  { key: "all", label: "ทั้งหมด" },
  { key: "today", label: "วันนี้" },
  { key: "new", label: "คนใหม่" },
  { key: "prayer", label: "คำอธิษฐาน" },
  { key: "photos", label: "รูปภาพ" },
  { key: "movement", label: "การเคลื่อนไหว" },
] as const;

type FilterKey = typeof filters[number]["key"];

export default function MissionFeed() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const filteredPosts = useMemo(() => {
    return missionPosts.filter((post) => {
      const haystack = post.group + " " + post.area + " " + post.location + " " + post.summary + " " + post.topic;
      const matchesQuery = !query || haystack.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "today" && post.time.includes("ชั่วโมง")) ||
        (activeFilter === "new" && post.newPeople.length > 0) ||
        (activeFilter === "prayer" && Boolean(post.prayer)) ||
        (activeFilter === "photos" && post.images.length > 0) ||
        activeFilter === "movement";
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query]);

  return (
    <AppLayout>
      <div className="mission-feed-page">
        <div className="mission-page-heading">
          <div>
            <span className="eyebrow blue-eyebrow">FAITHMAP · MISSION INTELLIGENCE</span>
            <h1>ฟีดพันธกิจ</h1>
            <p>เห็นการเคลื่อนไหวของพันธกิจทั้งหมดในที่เดียว โดยไม่ต้องไล่อ่าน LINE ทีละกลุ่ม</p>
          </div>
          <div className="mission-heading-actions">
            <Link href="/reports" className="mission-secondary-action"><Bell size={ICON_SIZE.sm} /> ตรวจสอบ 3</Link>
            <button className="primary-action"><Plus size={ICON_SIZE.sm} /> รายงานใหม่</button>
          </div>
        </div>

        <section className="mission-overview-grid">
          <div className="mission-overview-card blue">
            <span className="mission-overview-icon"><Users size={ICON_SIZE.lg} /></span>
            <div><small>กลุ่มพันธกิจ</small><strong>48</strong><span>กลุ่ม</span></div>
            <em>+2 จากสัปดาห์ที่แล้ว</em>
          </div>
          <div className="mission-overview-card green">
            <span className="mission-overview-icon">👥</span>
            <div><small>ผู้เข้าร่วม</small><strong>421</strong><span>คน</span></div>
            <em>+12%</em>
          </div>
          <div className="mission-overview-card orange">
            <span className="mission-overview-icon">🆕</span>
            <div><small>คนใหม่</small><strong>17</strong><span>คน</span></div>
            <em>+5 สัปดาห์นี้</em>
          </div>
          <div className="mission-overview-card purple">
            <span className="mission-overview-icon">📋</span>
            <div><small>ส่งรายงานแล้ว</small><strong>39</strong><span>กลุ่ม</span></div>
            <em>81% ของทั้งหมด</em>
          </div>
          <div className="mission-overview-card red">
            <span className="mission-overview-icon">!</span>
            <div><small>ยังไม่รายงาน</small><strong>9</strong><span>กลุ่ม</span></div>
            <em>ต้องติดตาม</em>
          </div>
        </section>

        <div className="mission-feed-layout">
          <main className="mission-feed-column">
            <section className="mission-feed-toolbar card-surface">
              <div className="mission-search">
                <Search size={ICON_SIZE.md} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหากลุ่ม คน สถานที่ หรือหัวข้อ..."
                  aria-label="ค้นหาฟีดพันธกิจ"
                />
                {query && <button onClick={() => setQuery("")} aria-label="ล้างการค้นหา"><X size={ICON_SIZE.xs} /></button>}
              </div>
              <div className="mission-filter-row">
                <Filter size={ICON_SIZE.sm} />
                {filters.map((filter) => (
                  <button
                    key={filter.key}
                    className={activeFilter === filter.key ? "active" : ""}
                    onClick={() => setActiveFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </section>

            <div className="mission-feed-date"><span>วันนี้ · 18 กันยายน 2569</span><b>{filteredPosts.length} การอัปเดต</b></div>

            {activeFilter === "movement" ? (
              <div className="movement-list">
                <MovementCard group="เมือง 1" values={[8, 12, 14, 16, 18]} newPeople={2} trend="+40%" />
                <MovementCard group="สมเด็จ" values={[14, 15, 17, 19, 21]} newPeople={1} trend="+21%" />
                <MovementCard group="ท่าคันโท" values={[11, 10, 9, 10, 9]} newPeople={0} trend="-18%" status="attention" />
                <MovementCard group="คำใหญ่" values={[12, 12, 11, 10, 10]} newPeople={0} trend="เงียบ 2 สัปดาห์" status="quiet" />
              </div>
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post) => <MissionPost key={post.id} post={post} />)
            ) : (
              <div className="mission-empty card-surface">
                <Sparkles size={ICON_SIZE["2xl"]} />
                <h2>ยังไม่มีการอัปเดตที่ตรงกับการค้นหา</h2>
                <p>ลองเปลี่ยนตัวกรองหรือคำค้นหา แล้วระบบจะแสดงกิจกรรมที่เกี่ยวข้อง</p>
              </div>
            )}
          </main>

          <aside className="mission-side-column">
            <section className="mission-side-card card-surface">
              <div className="mission-side-heading">
                <div><MapPin size={ICON_SIZE.sm} /><h2>สถานะกลุ่ม</h2></div>
                <Link href="/reports">ดูทั้งหมด</Link>
              </div>
              <div className="status-summary">
                <div><span className="green" /><strong>27</strong><small>เคลื่อนไหว</small></div>
                <div><span className="yellow" /><strong>8</strong><small>ยังไม่รายงาน</small></div>
                <div><span className="red" /><strong>5</strong><small>เงียบ 2+ สัปดาห์</small></div>
              </div>
              <div className="mission-side-map">
                <span className="map-pin p1">เมือง 1</span>
                <span className="map-pin p2">สมเด็จ</span>
                <span className="map-pin p3">คำใหญ่</span>
                <span className="map-pin p4">ท่าคันโท</span>
              </div>
            </section>

            <section className="mission-side-card card-surface mission-ai-card">
              <span className="mission-ai-icon"><Sparkles size={ICON_SIZE.md} /></span>
              <span className="eyebrow">AI INSIGHT</span>
              <h2>ระบบพบ 6 กลุ่มที่ควรติดตาม</h2>
              <p>กลุ่มเหล่านี้ไม่มีรายงานต่อเนื่องหรือจำนวนผู้เข้าร่วมลดลง ระบบจะแยกไว้ให้ตรวจสอบโดยไม่ตัดสินแทนผู้ดูแล</p>
              <Link href="/reports" className="text-button">เปิดรายการตรวจสอบ →</Link>
            </section>

            <section className="mission-side-card card-surface mission-priority">
              <div className="mission-side-heading"><div><Bell size={ICON_SIZE.sm} /><h2>สิ่งที่ควรดูวันนี้</h2></div></div>
              <ul>
                <li><b>9</b><span>กลุ่มยังไม่ส่งรายงาน</span></li>
                <li><b>17</b><span>คนใหม่ในสัปดาห์นี้</span></li>
                <li><b>31</b><span>รูปกิจกรรมใหม่</span></li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
