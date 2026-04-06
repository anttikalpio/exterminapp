import { z } from "zod";

export const createCustomerSchema = z.object({
  businessName: z.string().min(1).max(255),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email().max(255).optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional(),
  billingAddress: z.string().optional(),
  billingEmail: z.string().email().max(255).optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
