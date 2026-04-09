import { z } from "zod";

export const createVisitSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  visitedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const updateVisitSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  visitedAt: z.coerce.date().optional(),
  notes: z.string().optional().nullable(),
});

export const addVisitPoisonSchema = z.object({
  visitId: z.string().uuid(),
  trapId: z.string().uuid(),
  poisonType: z.string().min(1).max(100),
  quantityGrams: z.number().positive(),
  remainingGrams: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  recordedLatitude: z.number().optional(),
  recordedLongitude: z.number().optional(),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type AddVisitPoisonInput = z.infer<typeof addVisitPoisonSchema>;
