import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DefectMetricsSchema = z.object({
  openDefects: z.number(),
  critical: z.number(),
  inTesting: z.number(),
  verifiedAccepted: z.number(),
  reopened: z.number(),
  blockers: z.number(),
});

export const DefectRowSchema = z.object({
  id: z.string().uuid(),
  itemKey: z.string(),
  title: z.string(),
  type: z.string(),
  priority: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).nullable(),
  foundInEnvironment: z.enum(['development', 'staging', 'production', 'testing']).nullable(),
  assigneeId: z.string().uuid().nullable(),
  assigneeName: z.string().nullable(),
  scheduleState: z.string(),
  iterationId: z.string().uuid().nullable(),
  iterationName: z.string().nullable(),
  releaseId: z.string().uuid().nullable(),
  releaseName: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  parentKey: z.string().nullable(),
  parentTitle: z.string().nullable(),
  isBlocked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DefectListResponseSchema = z.object({
  metrics: DefectMetricsSchema,
  data: z.array(DefectRowSchema),
});

export class DefectListResponseDto extends createZodDto(DefectListResponseSchema) {}