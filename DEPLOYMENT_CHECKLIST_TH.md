# เช็คลิสต์ Production: Database, Clerk Webhook และ Vercel

โปรเจกต์นี้ประกอบด้วย React/Vite frontend, Express API, Drizzle ORM และ PostgreSQL/Neon บน Vercel

> **ห้าม commit ค่า secret** เช่น `DATABASE_URL`, `CLERK_SECRET_KEY` และ `CLERK_WEBHOOK_SIGNING_SECRET`

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
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

เพิ่มหรือแก้ทีละค่าแบบ interactive:

```bash
vercel env add NODE_ENV production
vercel env add DATABASE_DRIVER production
vercel env add DATABASE_URL production
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add CLERK_WEBHOOK_SIGNING_SECRET production
```

กรณีต้องแก้ค่าที่มีอยู่ ให้ลบแล้วเพิ่มใหม่ หรือใช้ Vercel Dashboard เพื่อแก้ค่าโดยตรง:

```bash
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
```

> `pk_live_...` เป็นค่าที่เปิดเผยใน browser ได้ แต่ `sk_live_...`, `DATABASE_URL` และ `whsec_...` ต้องเก็บเป็น secret

### Preview

หากต้องการ Preview แยกจาก Production ให้ใช้ test instance:

```bash
vercel env add DATABASE_DRIVER preview
vercel env add DATABASE_URL preview
vercel env add VITE_CLERK_PUBLISHABLE_KEY preview
vercel env add CLERK_SECRET_KEY preview
vercel env add CLERK_WEBHOOK_SIGNING_SECRET preview
```

อย่าใส่ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` เพราะโปรเจกต์นี้เป็น Vite และอ่านเฉพาะ `VITE_CLERK_PUBLISHABLE_KEY`

---

## 3. สาเหตุและวิธีแก้ `503 DATABASE_UNAVAILABLE`

Endpoint ที่ใช้ตรวจ:

```text
GET /api/health   # ตรวจว่า function ยังทำงานอยู่ ไม่แตะ database
GET /api/ready    # ตรวจ connection และรัน SELECT 1
GET /api/auth/me  # ต้องใช้ Clerk session และ database
```

ความหมายของผลลัพธ์:

| ผลลัพธ์ | ความหมาย |
| --- | --- |
| `/api/health` = 200 | Vercel function ทำงาน |
| `/api/ready` = 503 | Database URL/driver/สิทธิ์/เครือข่าย หรือ database ไม่พร้อม |
| `/api/auth/me` = 503 | API ยังใช้ database ไม่ได้ จึงทดสอบ login แบบสมบูรณ์ไม่ได้ |
| `/api/auth/me` = 401 | Database ผ่านแล้ว แต่ยังไม่มี Clerk session |
| `/api/auth/me` = 200 | Login และ database ทำงานร่วมกันแล้ว |

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

## 4. ตั้งค่า Clerk Webhook

### สร้าง endpoint ใน Clerk Dashboard

1. เข้า [Clerk Dashboard](https://dashboard.clerk.com/)
2. เลือก **Production instance** ให้ตรงกับ `pk_live_...` และ `sk_live_...`
3. ไปที่ **Webhooks**
4. กด **Add Endpoint**
5. ใส่ URL:

```text
https://puntakit-kalasin.vercel.app/api/webhooks/clerk
```

6. เลือก events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
7. กดสร้าง endpoint
8. คัดลอก **Signing Secret** ที่ขึ้นต้นด้วย `whsec_`
9. เพิ่มลง Vercel Production:

```bash
vercel env add CLERK_WEBHOOK_SIGNING_SECRET production
```

10. Redeploy หลังเพิ่ม secret

```bash
vercel --prod
```

Webhook handler จะ:

- ตรวจสอบ Svix signature จาก `svix-id`, `svix-timestamp`, `svix-signature`
- สร้างหรือ link user ด้วย `clerk_id`
- อัปเดตชื่อและ email เมื่อ `user.updated`
- เปลี่ยน local account เป็น `suspended` เมื่อ `user.deleted`
- ไม่ลบข้อมูลทางกายภาพ เพื่อรักษาความสัมพันธ์ใน database

ทดสอบ request ที่ไม่มี signature ได้ผลลัพธ์ `400` หลัง database พร้อมแล้ว:

```bash
curl -i -X POST https://puntakit-kalasin.vercel.app/api/webhooks/clerk \
  -H 'content-type: application/json' \
  --data '{"type":"user.created","data":{"id":"probe"}}'
```

Clerk Dashboard มีปุ่ม **Send Example** หรือ **Test** สำหรับส่ง signed delivery จริง ควรใช้วิธีนั้นเพื่อทดสอบ end-to-end

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
2. Login ผ่าน Clerk Production instance
3. เปิด Browser DevTools → Network
4. ตรวจ request:
   - `/api/auth/me` ต้องเป็น `200`
   - API dashboard/members/reports ต้องเป็น `200`
5. ถ้า `/api/auth/me` เป็น `401` ให้ตรวจ Clerk session หรือ domain configuration
6. ถ้าเป็น `503` ให้ตรวจ `/api/ready` และ `DATABASE_URL` ก่อน
7. ตรวจใน Clerk Webhooks ว่า delivery สำเร็จและ response เป็น `200`

---

## 7. Pre-deployment checklist

- [ ] Vercel CLI login แล้ว
- [ ] `vercel link` ชี้ไป `puntakit-kalasin`
- [ ] Production ใช้ `pk_live_...` และ `sk_live_...` คู่กัน
- [ ] Production มี `DATABASE_URL` จริงและเชื่อมต่อได้
- [ ] `DATABASE_DRIVER` ตรงกับ provider
- [ ] migration ถูก apply แล้ว
- [ ] มี `CLERK_WEBHOOK_SIGNING_SECRET`
- [ ] Clerk webhook ใช้ Production instance
- [ ] Webhook URL เป็น `/api/webhooks/clerk`
- [ ] เลือก events ครบ 3 รายการ
- [ ] `pnpm check` ผ่าน
- [ ] `pnpm test` ผ่าน
- [ ] `pnpm build` ผ่าน
- [ ] Vercel deployment เป็น `READY`
- [ ] `/api/health` เป็น 200
- [ ] `/api/ready` เป็น 200
- [ ] Login แล้ว `/api/auth/me` เป็น 200
