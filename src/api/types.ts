// The API's types, generated from its OpenAPI contract (src/api/generated, `npm run api:types`).
export type {
  ClientConfig,
  DevToken,
  DocStatus,
  DocumentOut,
  Expenses,
  Issue,
  NotificationOut,
  NotificationsOut,
  PairOffer,
  PlanInfo,
  PlanOut,
  SpaceOut,
  Summary,
} from "./generated";

import type { Collected } from "./generated";

// Phone pairing (pairkit's /v1/pair/* routes): what the phone gets back when it claims a
// code, and the grant it collects. ScribbleScan's grant hook adds the space to upload to.
export type { Claimed as PairClaim } from "./generated";
export type PairGrant = Collected & { space_id: string };

/** A locale pack's JSON Schema for one document type; fields carry "x-kind". */
export interface FieldSpec {
  "x-kind"?: "amount" | "number" | "date" | "code" | "text" | "rows";
  items?: { properties: Record<string, FieldSpec> };
}
export interface DocSchema {
  properties: Record<string, FieldSpec>;
}
