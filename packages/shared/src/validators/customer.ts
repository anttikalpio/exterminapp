import { z } from "zod";

export const SUPPORTED_LOCALES = ["en", "fi"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const localeSchema = z.enum(SUPPORTED_LOCALES);

export const createCustomerSchema = z.object({
  customerNumber: z.string().max(50).optional(),
  businessName: z.string().min(1).max(255),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email().max(255).optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional(),
  orderingParty: z.string().optional(),
  billingStreetAddress: z.string().max(255).optional(),
  billingPoBox: z.string().max(50).optional(),
  billingZipCode: z.string().max(20).optional(),
  billingCity: z.string().max(100).optional(),
  billingEinvoiceAddress: z.string().max(255).optional(),
  billingEmail: z.string().email().max(255).optional().or(z.literal("")),
  preferredLanguage: localeSchema.optional(),
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
