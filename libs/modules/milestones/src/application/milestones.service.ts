import { Inject, Injectable, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { NotFoundException } from '@platform';
import type { JwtPayload, CursorPayload, PagedResult } from '@platform';
import { ProjectsService } from '@modules/projects';
import { AccessService } from '@modules/access';
import { PERMISSION } from '@shared-kernel';
import { IMilestoneRepository, MILESTONE_REPOSITORY } from '../domain/ports/milestone.repository';
import type { Milestone, UpdateMilestoneInput } from '../domain/milestone.types';

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    @Inject(MILESTONE_REPOSITORY) private readonly milestoneRepo: IMilestoneRepository,
    private readonly projectsService: ProjectsService,
    private readonly accessService: AccessService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async listMilestones(
    actor: JwtPayload,
    projectId: string,
    args: { limit: number; cursor: CursorPayload | null },
  ): Promise<PagedResult<Milestone>> {
    await this.projectsService.getProject(actor.tenantId, projectId);
    return this.milestoneRepo.listByProject(projectId, actor.tenantId, args);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createMilestone(
    actor: JwtPayload,
    projectId: string,
    name: string,
    opts: { description?: string; notes?: string; status?: string; ownerId?: string; releaseIds?: string[] } = {},
  ): Promise<Milestone> {
    await this.projectsService.getProject(actor.tenantId, projectId);

    const releaseIds = opts.releaseIds ?? [];
    const targetDates = releaseIds.length > 0
      ? await this.milestoneRepo.deriveTargetDates(releaseIds, actor.tenantId)
      : { startDate: null, endDate: null };

    const milestone = await this.milestoneRepo.create({
      id: uuidv7(),
      tenantId: actor.tenantId,
      projectId,
      name,
      description: opts.description,
      notes: opts.notes,
      status: (opts.status as any) ?? 'planned',
      ownerId: opts.ownerId,
      releaseIds,
    });

    if (releaseIds.length > 0) {
      await this.milestoneRepo.setReleaseLinks(milestone.id, releaseIds);
      // Update derived target dates
      await this.milestoneRepo.update(milestone.id, {
        targetStartDate: targetDates.startDate,
        targetEndDate: targetDates.endDate,
      });
    }

    this.logger.log({ milestoneId: milestone.id, projectId, userId: actor.sub }, 'Milestone created');
    return { ...milestone, ...targetDates, releaseIds };
  }

  // ── Get ───────────────────────────────────────────────────────────────────

  async getMilestone(tenantId: string, id: string): Promise<Milestone> {
    const milestone = await this.milestoneRepo.findById(id);
    if (!milestone || milestone.tenantId !== tenantId) {
      throw new NotFoundException('MILESTONE_NOT_FOUND', 'Milestone not found');
    }
    return milestone;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateMilestone(actor: JwtPayload, id: string, input: UpdateMilestoneInput): Promise<Milestone> {
    const milestone = await this.getMilestone(actor.tenantId, id);
    await this.accessService.assertProjectPermission(actor, milestone.projectId, PERMISSION.MILESTONE_MANAGE);

    // If releaseIds changed, recalculate target dates
    if (input.releaseIds !== undefined) {
      const targetDates = input.releaseIds.length > 0
        ? await this.milestoneRepo.deriveTargetDates(input.releaseIds, actor.tenantId)
        : { startDate: null, endDate: null };
      input.targetStartDate = targetDates.startDate;
      input.targetEndDate = targetDates.endDate;
      await this.milestoneRepo.setReleaseLinks(id, input.releaseIds);
    }

    const updated = await this.milestoneRepo.update(id, input);
    const releaseIds = await this.milestoneRepo.getReleaseIds(id);
    return { ...updated, releaseIds };
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteMilestone(actor: JwtPayload, id: string): Promise<void> {
    const milestone = await this.getMilestone(actor.tenantId, id);
    await this.accessService.assertProjectPermission(actor, milestone.projectId, PERMISSION.MILESTONE_MANAGE);
    await this.milestoneRepo.setReleaseLinks(id, []); // clean up links
    await this.milestoneRepo.delete(id);
    this.logger.log({ milestoneId: id }, 'Milestone deleted');
  }
}