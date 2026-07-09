import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { milestoneStatusEnum } from '../../../../../../../db/schema/enums';

export const MilestoneResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(milestoneStatusEnum.enumValues),
  ownerId: z.string().uuid().nullable(),
  targetStartDate: z.string().nullable().describe('YYYY-MM-DD, derived from linked releases'),
  targetEndDate: z.string().nullable().describe('YYYY-MM-DD, derived from linked releases'),
  releaseIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class MilestoneResponseDto extends createZodDto(MilestoneResponseSchema) {}

export const MilestoneListItemSchema = MilestoneResponseSchema;
export class MilestoneListItemDto extends createZodDto(MilestoneListItemSchema) {}