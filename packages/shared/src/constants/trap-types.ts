export const TRAP_TYPES = [
  "bait_station",
  "snap_trap",
  "glue_board",
  "electronic",
  "live_catch",
] as const;

export type TrapType = (typeof TRAP_TYPES)[number];

export const TRAP_STATUSES = [
  "active",
  "inactive",
  "damaged",
  "removed",
] as const;

export type TrapStatus = (typeof TRAP_STATUSES)[number];
