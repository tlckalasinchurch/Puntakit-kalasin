import express, { Router, type Request } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { groups, mediaAssets, members, missionActivities, missionActivityMedia, type MediaAsset } from "../../shared/schema.js";
import { ADMIN_SHELL_ROLES, CREATE_ROLES, MEMBER_UPDATE_ROLES, PRIVILEGED_ROLES } from "../../shared/roles.js";
import { requireAuth } from "../middleware/auth.js";
import { canViewMember, resolveMembershipScope } from "../lib/membershipScope.js";
import { logAudit } from "../lib/audit.js";
import { assertGroupInScope, assertMembersInScope, getLedGroupIds } from "../lib/careScope.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import {
  IMAGE_CONTENT_TYPES,
  MEDIA_MAX_BYTES,
  deleteImage,
  readImage,
  sniffImage,
  storeImage,
} from "../lib/mediaStore.js";

/**
 * Private image storage for member photos and mission photos.
 *
 *   POST /api/media?kind=member_avatar&memberId=<uuid>   body: raw image bytes
 *   POST /api/media?kind=mission_photo&groupId=<uuid>    body: raw image bytes
 *   GET  /api/media/:id                                  the image, if you may see it
 *
 * Files are never public. The client resizes before upload (a phone photo is
 * several MB), the server re-checks the real bytes (`sniffImage`), caps the
 * size at Vercel's request limit and records who uploaded what.
 */
export const mediaRouter = Router();

mediaRouter.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rawImage = express.raw({ type: IMAGE_CONTENT_TYPES, limit: MEDIA_MAX_BYTES });

mediaRouter.post("/", rawImage, async (req, res, next) => {
  try {
    const user = req.user!;
    const kind = req.query.kind;
    const memberId = typeof req.query.memberId === "string" ? req.query.memberId : undefined;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (kind !== "member_avatar" && kind !== "mission_photo") {
      throw new ValidationError("ชนิดรูปไม่ถูกต้อง");
    }
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw new ValidationError("ไม่พบไฟล์รูปภาพ — ส่งเป็น JPEG, PNG หรือ WebP ขนาดไม่เกิน 4 MB");
    }
    const contentType = sniffImage(bytes);
    if (!contentType) throw new ValidationError("ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ (JPEG, PNG, WebP)");

    const db = getDb();
    if (kind === "member_avatar") {
      if (!memberId || !UUID.test(memberId)) throw new ValidationError("ต้องระบุสมาชิก");
      if (!MEMBER_UPDATE_ROLES.includes(user.role)) throw new ForbiddenError("คุณไม่มีสิทธิ์เปลี่ยนรูปสมาชิก");
      await assertMembersInScope(req, [memberId]);
      const [member] = await db
        .select({ id: members.id, avatarUrl: members.avatarUrl })
        .from(members)
        .where(and(eq(members.id, memberId), isNull(members.deletedAt)))
        .limit(1);
      if (!member) throw new NotFoundError("ไม่พบสมาชิก");

      const stored = await storeImage("avatars", bytes, contentType);
      const [asset] = await db
        .insert(mediaAssets)
        .values({
          kind,
          storage: stored.storage,
          pathname: stored.pathname,
          contentType,
          sizeBytes: bytes.length,
          memberId,
          uploadedById: user.id,
        })
        .returning();
      const url = `/api/media/${asset.id}`;
      await db.update(members).set({ avatarUrl: url, updatedById: user.id, updatedAt: new Date() }).where(eq(members.id, memberId));

      // Retire this member's earlier uploaded photos (history of bytes is not kept).
      const previous = await db
        .select()
        .from(mediaAssets)
        .where(and(eq(mediaAssets.memberId, memberId), eq(mediaAssets.kind, "member_avatar"), isNull(mediaAssets.deletedAt)));
      for (const old of previous.filter((p) => p.id !== asset.id)) {
        await db.update(mediaAssets).set({ deletedAt: new Date() }).where(eq(mediaAssets.id, old.id));
        await deleteImage({ storage: old.storage, pathname: old.pathname });
      }
      await logAudit({ req, action: "MEMBER_AVATAR_CHANGED", entityType: "member", entityId: memberId, details: { mediaId: asset.id } });
      res.status(201).json({ success: true, data: { id: asset.id, url } });
      return;
    }

    // mission_photo
    if (!CREATE_ROLES.includes(user.role)) throw new ForbiddenError("คุณไม่มีสิทธิ์อัปโหลดภาพพันธกิจ");
    if (groupId && !UUID.test(groupId)) throw new ValidationError("พันธกิจไม่ถูกต้อง");
    // A group_leader must name a group they lead; other roles may leave it empty.
    await assertGroupInScope(req, groupId ?? null);
    if (groupId) {
      const [group] = await db.select({ id: groups.id }).from(groups).where(and(eq(groups.id, groupId), isNull(groups.deletedAt))).limit(1);
      if (!group) throw new NotFoundError("ไม่พบพันธกิจ");
    }
    const stored = await storeImage("mission", bytes, contentType);
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        kind,
        storage: stored.storage,
        pathname: stored.pathname,
        contentType,
        sizeBytes: bytes.length,
        groupId: groupId ?? null,
        uploadedById: user.id,
      })
      .returning();
    res.status(201).json({ success: true, data: { id: asset.id, url: `/api/media/${asset.id}` } });
  } catch (err) {
    next(err);
  }
});

/** May this request read the image? Same visibility as the thing the image belongs to. */
async function canReadAsset(req: Request, asset: MediaAsset): Promise<boolean> {
  const user = req.user!;
  if (asset.uploadedById === user.id) return true;

  if (asset.kind === "member_avatar") {
    if (!asset.memberId) return false;
    if (user.role === "member") {
      const [own] = await getDb()
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.id, asset.memberId), eq(members.userId, user.id)))
        .limit(1);
      return Boolean(own);
    }
    if (!ADMIN_SHELL_ROLES.includes(user.role)) return false;
    // A body leader sees the members of the care groups under their body on the
    // membership page, so they must be able to load those faces too.
    if (await canViewMember(await resolveMembershipScope(user), user.role, asset.memberId)) return true;
    try {
      await assertMembersInScope(req, [asset.memberId]);
      return true;
    } catch {
      return false;
    }
  }

  // mission_photo: privileged roles; a group_leader for a group they lead;
  // anyone who may read the (published) activity the photo is attached to.
  if (PRIVILEGED_ROLES.includes(user.role)) return true;
  if (user.role === "group_leader" && asset.groupId) {
    if ((await getLedGroupIds(user.id)).includes(asset.groupId)) return true;
  }
  if (user.role === "member") return false;
  const url = `/api/media/${asset.id}`;
  const attached = await getDb()
    .select({ status: missionActivities.status, createdById: missionActivities.createdById, groupId: missionActivities.groupId })
    .from(missionActivityMedia)
    .innerJoin(missionActivities, eq(missionActivityMedia.activityId, missionActivities.id))
    .where(and(eq(missionActivityMedia.url, url), isNull(missionActivities.deletedAt)));
  if (attached.some((a) => a.status === "published" || a.createdById === user.id)) return true;
  if (user.role === "group_leader") {
    const led = await getLedGroupIds(user.id);
    const ids = attached.map((a) => a.groupId).filter((g): g is string => Boolean(g));
    return ids.some((g) => led.includes(g));
  }
  return false;
}

mediaRouter.get("/:id", async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) throw new NotFoundError("ไม่พบรูปภาพ");
    const [asset] = await getDb()
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, req.params.id), isNull(mediaAssets.deletedAt)))
      .limit(1);
    // Same 404 whether it does not exist or you may not see it.
    if (!asset || !(await canReadAsset(req, asset))) throw new NotFoundError("ไม่พบรูปภาพ");
    const bytes = await readImage({ storage: asset.storage, pathname: asset.pathname });
    if (!bytes) throw new NotFoundError("ไม่พบรูปภาพ");
    res.set({
      "Content-Type": asset.contentType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.send(bytes);
  } catch (err) {
    next(err);
  }
});
