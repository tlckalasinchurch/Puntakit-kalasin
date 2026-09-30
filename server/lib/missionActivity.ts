import { getDb } from "../db/client.js";
import {
  missionActivityMedia,
  missionActivities,
  type MissionActivityType,
  type MissionMediaKind,
} from "../../shared/schema.js";

export interface CreateMissionActivityFields {
  type: MissionActivityType;
  title: string;
  story?: string | null;
  occurredAt: Date;
  groupId?: string | null;
  placeLabel?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  createdById: string | null;
}

/**
 * Insert a Mission Activity row (always starts as "draft" — the DB
 * default). Shared by the direct create endpoint
 * (server/routes/activities.ts) and Mission Inbox publish
 * (server/routes/submissions.ts) so both paths write the one activity
 * table the same way, per docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md's
 * "never duplicate the same ministry event" rule.
 */
export async function insertMissionActivity(fields: CreateMissionActivityFields) {
  const db = getDb();
  const [created] = await db
    .insert(missionActivities)
    .values({
      type: fields.type,
      title: fields.title,
      story: fields.story || null,
      occurredAt: fields.occurredAt,
      groupId: fields.groupId || null,
      placeLabel: fields.placeLabel || null,
      latitude: fields.latitude || null,
      longitude: fields.longitude || null,
      createdById: fields.createdById,
    })
    .returning();
  return created;
}

export async function insertMissionActivityMedia(
  activityId: string,
  media: { url: string; kind?: MissionMediaKind }[]
) {
  if (media.length === 0) return;
  const db = getDb();
  await db.insert(missionActivityMedia).values(
    media.map((m, index) => ({
      activityId,
      url: m.url,
      kind: m.kind ?? "image",
      sortOrder: index,
    }))
  );
}
