import { z } from "zod";
import { UserRole } from "../enums";

export const staffRosterItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string(),
  role: z.nativeEnum(UserRole),
});
export type StaffRosterItem = z.infer<typeof staffRosterItemSchema>;
