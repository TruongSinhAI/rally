import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PageQuerySchema } from '@platform';

export const DefectQuerySchema = PageQuerySchema.extend({
  projectId: z.string().uuid(),
  search: z.string().max(200).optional(),
  severity: z.enum(['all', 'critical', 'high', 'medium', 'low']).optional().default('all'),
  environment: z.enum(['all', 'development', 'staging', 'production', 'testing']).optional().default('all'),
});
export class DefectQueryDto extends createZodDto(DefectQuerySchema) {}