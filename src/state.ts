import type { SpaceOut } from "./api/types";
import { thisMonth } from "./format";

export const state = {
  spaces: [] as SpaceOut[],
  space: null as SpaceOut | null,
  month: thisMonth(),
  categories: [] as string[],
};

/** The selected space; the app only shows views once one is loaded. */
export function currentSpace(): SpaceOut {
  if (!state.space) throw new Error("no space selected");
  return state.space;
}
