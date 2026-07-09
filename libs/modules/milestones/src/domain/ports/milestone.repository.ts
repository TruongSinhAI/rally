import type { CursorPayload, PagedResult } from '@platform';
import type { Milestone, CreateMilestoneInput, UpdateMilestoneInput } from '../milestone.types';

export const MILESTONE_REPOSITORY = Symbol('MILESTONE_REPOSITORY');

export interface IMilestoneRepository {
  findById(id: string): Promise<Milestone | null>;
  listByProject(
    projectId: string,
    tenantId: string,
    args: { limit: number; cursor: CursorPayload | null },
  ): Promise<PagedResult<Milestone>>;
  create(input: CreateMilestoneInput): Promise<Milestone>;
  update(id: string, input: UpdateMilestoneInput): Promise<Milestone>;
  delete(id: string): Promise<void>;
  /** Set linked releases for a milestone (replace all). */
  setReleaseLinks(milestoneId: string, releaseIds: string[]): Promise<void>;
  /** Get linked release IDs for a milestone. */
  getReleaseIds(milestoneId: string): Promise<string[]>;
  /** Derive target dates from linked releases. */
  deriveTargetDates(releaseIds: string[], tenantId: string): Promise<{ startDate: string | null; endDate: string | null }>;
}