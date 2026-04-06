export const POISON_TYPES = [
  "brodifacoum",
  "bromadiolone",
  "difethialone",
  "difenacoum",
  "flocoumafen",
  "chlorophacinone",
  "diphacinone",
  "warfarin",
  "zinc_phosphide",
  "bromethalin",
] as const;

export type PoisonType = (typeof POISON_TYPES)[number];
