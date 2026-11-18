import { z } from "zod";
import { name } from "./api";
export const emptyBillingCommand = z.strictObject({});
export const requestDeletion = z.strictObject({
  confirmName: name, exportAcknowledged: z.literal(true),
});
