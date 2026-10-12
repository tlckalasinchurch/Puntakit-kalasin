# เช็คลิสต์ Production: Database และ Vercel

โปรเจกต์นี้ประกอบด้วย React/Vite frontend, Express API, Drizzle ORM และ PostgreSQL/Neon บน Vercel

> **ห้าม commit ค่า secret** เช่น `DATABASE_URL`

## 1. ตรวจว่าใช้ Vercel project ถูกตัว

รันจากโฟลเดอร์ repository:

```bash
vercel login
vercel link
vercel project ls
```

เลือก project:

```text
puntakit-kalasin
```

ตรวจ environment names และ target โดยไม่ต้องเปิดเผยค่า:

```bash
vercel env ls production
vercel env ls preview
```

Production ต้องใช้ target `production` ส่วน Preview ต้องใช้ target `preview`

---

## 2. ตั้งค่า Environment Variables

### Production ที่ต้องมี

```text
NODE_ENV=production
DATABASE_DRIVER=neon
DATABASE_URL=postgresql://...
```

เพิ่มหรือแก้ทีละค่าแบบ interactive:

```bash
vercel env add NODE_ENV production
vercel env add DATABASE_DRIVER production
vercel env add DATABASE_URL production
```

กรณีต้องแก้ค่าที่มีอยู่ ให้ลบแล้วเพิ่มใหม่ หรือใช้ Vercel Dashboard เพื่อแก้ค่าโดยตรง:

```bash
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
```

> `DATABASE_URL` ต้องเก็บเป็น secret ไม่ใช่ค่าที่เปิดเผยได้ ระบบยืนยันตัวตนด้วย PIN ของผู้ใช้เอง (เก็บ PIN เป็น hash แบบ scrypt และเก็บ session ในตาราง `user_sessions`) จึงไม่ต้องตั้งค่า secret ของผู้ให้บริการยืนยันตัวตนใด ๆ

### Preview

หากต้องการ Preview แยกจาก Production ให้ใช้ test instance:

```bash
vercel env add DATABASE_DRIVER preview
vercel env add DATABASE_URL preview
```

---

## 3. สาเหตุและวิธีแก้ `503 DATABASE_UNAVAILABLE`

Endpoint ที่ใช้ตรวจ:

```text
GET /api/health   # ตรวจว่า function ยังทำงานอยู่ ไม่แตะ database
GET /api/ready    # ตรวจ connection และรัน SELECT 1
GET /api/auth/me  # ต้องใช้ session จากการล็อกอินด้วย PIN และ database
```

ความหมายของผลลัพธ์:

| ผลลัพธ์ | ความหมาย |
| --- | --- |
| `/api/health` = 200 | Vercel function ทำงาน |
| `/api/ready` = 503 | Database URL/driver/สิทธิ์/เครือข่าย หรือ database ไม่พร้อม |
| `/api/auth/me` = 503 | API ยังใช้ database ไม่ได้ จึงทดสอบ login แบบสมบูรณ์ไม่ได้ |
| `/api/auth/me` = 401 | Database ผ่านแล้ว แต่ยังไม่มี session (ยังไม่ได้ล็อกอิน หรือ session หมดอายุ) |
| `/api/auth/me` = 200 | Login และ database ทำงานร่วมกันแล้ว |
| `/api/ready` = 503 `SUPER_ADMIN_PIN_MISSING` | มีบัญชี `super_admin` ที่ยังไม่ได้ตั้ง PIN จึงล็อกอินไม่ได้ — ตั้งด้วย `pnpm db:set-pin` (เฉพาะ production เท่านั้น) |

### ตรวจค่า driver

Production รองรับ:

- `neon` — Neon serverless driver
- `postgres` — PostgreSQL ผ่าน `postgres-js`
- `pglite` — local development เท่านั้น และถูกปฏิเสธใน Production

กรณีใช้ Neon แนะนำ:

```text
DATABASE_DRIVER=neon
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require
```

กรณีใช้ PostgreSQL อื่น เช่น Supabase pooler:

```text
DATABASE_DRIVER=postgres
DATABASE_URL=postgresql://...
POSTGRES_SSL=require
```

### ตรวจรูปแบบ URL

ต้องขึ้นต้นด้วยอย่างใดอย่างหนึ่ง:

```text
postgres://
postgresql://
```

อย่าใส่ quote ติดไปกับค่าใน Vercel เช่น:

```text
DATABASE_URL="postgresql://..."  # ไม่แนะนำ
```

### ตรวจ connection และ schema แบบปลอดภัย

ดึง env ลงไฟล์ local ที่ gitignored เท่านั้น:

```bash
vercel env pull .env.production.local production
chmod 600 .env.production.local
```

โหลด env เข้า shell แล้วทดสอบ migration:

```bash
set -a
source .env.production.local
set +a
NODE_ENV=production pnpm db:migrate:env
```

จากนั้นทดสอบ build และรัน local server ด้วยค่าจริง:

```bash
pnpm check
pnpm build
NODE_ENV=production pnpm start
```

อีก terminal:

```bash
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/ready
```

> ห้ามพิมพ์ `DATABASE_URL` ออกหน้าจอหรือใส่ log หากต้องแชร์ผลลัพธ์ ให้แชร์เฉพาะ driver และ status code

### Migration policy ที่แนะนำบน Vercel

ตั้งค่า:

```text
DB_AUTO_MIGRATE=false
```

แล้วรัน migration แบบควบคุมเองจากเครื่องที่มี network ถึง database:

```bash
vercel env pull .env.production.local production
set -a && source .env.production.local && set +a
NODE_ENV=production pnpm db:migrate:env
```

ไม่แนะนำให้ทุก serverless cold start รัน migration พร้อมกัน หากต้องการใช้ auto migration ชั่วคราว ให้ตั้ง `DB_AUTO_MIGRATE=true` แล้ว redeploy เพียงครั้งเดียว จากนั้นเปลี่ยนกลับเป็น `false`

---

## 4. จัดการบัญชีผู้ใช้และสิทธิ์

ระบบไม่มีผู้ให้บริการยืนยันตัวตนภายนอก และไม่มี webhook สำหรับซิงก์ผู้ใช้ บัญชีทั้งหมดเป็นแถวในตาราง `users` และผู้ใช้ล็อกอินด้วย PIN 6 หลัก

- บัญชี `admin` และ `super_admin` สร้างผ่านหน้าจอจัดการผู้ใช้ในระบบ หรือใช้ `pnpm db:set-pin`
- การเปลี่ยนสถานะหรือสิทธิ์ของผู้ใช้ทำผ่านระบบโดยตรง ไม่มีการซิงก์จากภายนอก
- **PIN เริ่มต้น `DEFAULT_SUPER_ADMIN_PIN` ถูกเขียนเฉพาะฐานข้อมูล PGlite ในเครื่องเท่านั้น** ระบบจะไม่ seed ลงฐานข้อมูล remote หรือ production แม้ตั้ง `DB_AUTO_MIGRATE=true` ก็ตาม (`server/db/bootstrap.ts`) ดังนั้นบัญชี `super_admin` บน production ต้องตั้ง PIN เองด้วย `pnpm db:set-pin` — ถ้ายังไม่มี ระบบจะตอบ `/api/ready` ด้วย `503 SUPER_ADMIN_PIN_MISSING` (แต่ `/api/health` ยังเป็น `200` เพื่อให้ตรวจสอบปัญหาได้)

หมายเหตุ: ถ้าเคยตั้งค่า `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` หรือ `VITE_CLERK_PUBLISHABLE_KEY` ไว้ใน Vercel ค่าเหล่านั้นไม่ถูกอ่านแล้ว สามารถลบออกได้

---

## 5. Redeploy และตรวจสถานะ

ตรวจ deployment ล่าสุด:

```bash
vercel ls puntakit-kalasin
```

Deploy Production:

```bash
vercel --prod
```

หรือถ้าต้องการระบุ project:

```bash
vercel deploy --prod --name puntakit-kalasin
```

ตรวจ endpoint หลัง deployment เป็น `READY`:

```bash
BASE_URL=https://puntakit-kalasin.vercel.app
curl -i "$BASE_URL/api/health"
curl -i "$BASE_URL/api/ready"
curl -i "$BASE_URL/login"
```

คาดหวัง:

```text
/api/health -> 200
/api/ready  -> 200
/login      -> 200
```

---

## 6. ทดสอบ Login และข้อมูลจริง

1. เปิด `https://puntakit-kalasin.vercel.app/login`
2. Login ด้วย PIN ของบัญชีทดสอบ
3. เปิด Browser DevTools → Network
4. ตรวจ request:
   - `/api/auth/me` ต้องเป็น `200`
   - API dashboard/members/reports ต้องเป็น `200`
5. ถ้า `/api/auth/me` เป็น `401` ให้ตรวจว่า session หมดอายุหรือยังไม่ได้ล็อกอิน
6. ถ้าเป็น `503` ให้ตรวจ `/api/ready` และ `DATABASE_URL` ก่อน
7. ทดสอบ PIN ผิดแล้วต้องได้ข้อความผิดพลาดทั่วไป และบัญชีต้องถูกล็อกชั่วคราวเมื่อพยายามผิดครบตามที่กำหนด

---

## 7. Pre-deployment checklist

- [ ] Vercel CLI login แล้ว
- [ ] `vercel link` ชี้ไป `puntakit-kalasin`
- [ ] Production มี `DATABASE_URL` จริงและเชื่อมต่อได้
- [ ] `DATABASE_DRIVER` ตรงกับ provider
- [ ] migration ถูก apply แล้ว
- [ ] ทุกบัญชี `super_admin` บน production ตั้ง PIN แล้ว ด้วย `DATABASE_DRIVER=neon DATABASE_URL=... pnpm db:set-pin:env -- <email> <pin>` (`/api/ready` ไม่ตอบ `503 SUPER_ADMIN_PIN_MISSING`)
  - ห้ามใช้ `pnpm db:set-pin` ตังแต่ตั้งแล้ว เพราะคำสั่งนี้โหลด `.env.local` ซึ่งชี้ฐานข้อมูล PGlite ในเครื่อง ไม่ใช่ production
- [ ] `pnpm check` ผ่าน
- [ ] `pnpm test` ผ่าน
- [ ] `pnpm build` ผ่าน
- [ ] Vercel deployment เป็น `READY`
- [ ] `/api/health` เป็น 200
- [ ] `/api/ready` เป็น 200
- [ ] Login แล้ว `/api/auth/me` เป็น 200
