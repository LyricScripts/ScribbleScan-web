// The API's types, generated from its OpenAPI contract (src/api/generated, `npm run api:types`).
export type {
  ClientConfig,
  DocStatus,
  DocumentOut,
  Expenses,
  Issue,
  PairOffer,
  SpaceOut,
  Summary,
} from "./generated";

// pairkit's pairing routes (/v1/pair/*) don't declare response models yet, so these
// mirror what pairkit returns.
export interface PairClaim {
  offer_id: string;
  claimer_key: string;
  shower: string | null;
}
export interface PairGrant {
  token: string;
  space_id: string;
}

/** A locale pack's JSON Schema for one document type; fields carry "x-kind". */
export interface FieldSpec {
  "x-kind"?: "amount" | "number" | "date" | "code" | "text" | "rows";
  items?: { properties: Record<string, FieldSpec> };
}
export interface DocSchema {
  properties: Record<string, FieldSpec>;
}
