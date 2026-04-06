import { z } from "zod";

export const createEmployeeSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(["admin", "field_technician"]),
  phone: z.string().max(30).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ password: true })
  .partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
