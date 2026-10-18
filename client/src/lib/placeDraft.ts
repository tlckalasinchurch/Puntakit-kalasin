/** The text fields of a group's place that the map dialog edits next to its coordinates and photo. */
export interface PlaceDraft {
  description: string;
  meetingDay: string;
  meetingTime: string;
  meetingLocation: string;
}

export const EMPTY_PLACE_DRAFT: PlaceDraft = { description: "", meetingDay: "", meetingTime: "", meetingLocation: "" };

type PlaceSource = { [K in keyof PlaceDraft]?: string | null };

export function placeDraftOf(group: PlaceSource): PlaceDraft {
  return {
    description: group.description ?? "",
    meetingDay: group.meetingDay ?? "",
    meetingTime: group.meetingTime ?? "",
    meetingLocation: group.meetingLocation ?? "",
  };
}

/**
 * What goes into the PUT body. Fields are trimmed and kept as strings: an empty string clears the
 * stored value, which the server's schema accepts (`.optional().or(z.literal(""))`).
 */
export function placePatchOf(draft: PlaceDraft): PlaceDraft {
  return {
    description: draft.description.trim(),
    meetingDay: draft.meetingDay.trim(),
    meetingTime: draft.meetingTime.trim(),
    meetingLocation: draft.meetingLocation.trim(),
  };
}
