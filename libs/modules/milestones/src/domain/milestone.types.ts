import type { MilestoneStatus } from '../../../../../db/schema/enums';
export type { MilestoneStatus };

export interface Milestone {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description: string | null;
  notes: string | null;
  status: MilestoneStatus;
  ownerId: string | null;
  targetStartDate: string | null; // YYYY-MM-DD (derived from linked releases)
  targetEndDate: string | null; // YYYY-MM-DD (derived from linked releases)
  releaseIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMilestoneInput {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description?: string;
  notes?: string;
  status?: MilestoneStatus;
  ownerId?: string;
  releaseIds?: string[];
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string | null;
  notes?: string | null;
  status?: MilestoneStatus;
  ownerId?: string | null;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
  releaseIds?: string[];
}