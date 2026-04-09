import { z } from "zod";

export const WORK_ORDER_STATUSES = ["active", "completed", "cancelled"] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const createWorkOrderSchema = z.object({
  customerId: z.string().uuid(),
  siteId: z.string().uuid(),
  workOrderNumber: z.string().max(50).optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(WORK_ORDER_STATUSES).optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

export const updateWorkOrderSchema = z.object({
  siteId: z.string().uuid().optional(),
  workOrderNumber: z.string().max(50).optional().nullable(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(WORK_ORDER_STATUSES).optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
