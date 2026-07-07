import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

/** One enriched service-record row as returned by the list queries. */
export type ServiceRecordItem = FunctionReturnType<
  typeof api.serviceRecords.listForPet
>[number];
