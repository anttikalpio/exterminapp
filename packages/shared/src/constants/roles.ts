export const ROLES = {
  ADMIN: "admin",
  FIELD_TECHNICIAN: "field_technician",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
