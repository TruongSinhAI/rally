import { Injectable } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';
import { InjectDrizzle, buildPageResult } from '@platform';
import type { DrizzleDB, CursorPayload, PagedResult } from '@platform';
import { milestones, milestoneReleases, releases } from '../../../../../../db/schema/work';
import type { Milestone, CreateMilestoneInput, UpdateMilestoneInput } from '../../domain/milestone.types';
import { IMilestoneRepository } from '../../domain/ports/milestone.repository';

@Injectable()
export class MilestoneDrizzleRepository implements IMilestoneRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Milestone | null> {
    const rows = await this.db.select().from(milestones).where(eq(milestones.id, id)).limit(1);
    if (!rows[0]) return null;
    const releaseIds = await this.getReleaseIds(id);
    return { ...rows[0], releaseIds };
  }

  async listByProject(
    projectId: string,
    tenantId: string,
    { limit, cursor }: { limit: number; cursor: CursorPayload | null },
  ): Promise<PagedResult<Milestone>> {
    const conditions = [eq(milestones.projectId, projectId), eq(milestones.tenantId, tenantId)];
    if (cursor) {
      conditions.push(lt(milestones.createdAt, new Date(cursor.k[0] as string)));
    }

    const rows = await this.db
      .select()
      .from(milestones)
      .where(and(...conditions))
      .orderBy(milestones.createdAt)
      .limit(limit + 1);

    // Attach release IDs for each milestone
    const withReleases = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        releaseIds: await this.getReleaseIds(row.id),
      })),
    );

    return buildPageResult(withReleases as Milestone[], limit, (r) => [r.createdAt.toISOString()]);
  }

  async create(input: CreateMilestoneInput): Promise<Milestone> {
    const rows = await this.db
      .insert(milestones)
      .values({
        id: input.id,
        tenantId: input.tenantId,
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        notes: input.notes,
        status: input.status ?? 'planned',
        ownerId: input.ownerId,
        targetStartDate: null,
        targetEndDate: null,
      })
      .returning();
    return { ...rows[0], releaseIds: input.releaseIds ?? [] };
  }

  async update(id: string, input: UpdateMilestoneInput): Promise<Milestone> {
    const rows = await this.db
      .update(milestones)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.ownerId !== undefined && { ownerId: input.ownerId }),
        ...(input.targetStartDate !== undefined && { targetStartDate: input.targetStartDate }),
        ...(input.targetEndDate !== undefined && { targetEndDate: input.targetEndDate }),
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, id))
      .returning();
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(milestones).where(eq(milestones.id, id));
  }

  async setReleaseLinks(milestoneId: string, releaseIds: string[]): Promise<void> {
    await this.db.delete(milestoneReleases).where(eq(milestoneReleases.milestoneId, milestoneId));
    if (releaseIds.length > 0) {
      await this.db.insert(milestoneReleases).values(
        releaseIds.map((releaseId) => ({ milestoneId, releaseId })),
      );
    }
  }

  async getReleaseIds(milestoneId: string): Promise<string[]> {
    const rows = await this.db
      .select({ releaseId: milestoneReleases.releaseId })
      .from(milestoneReleases)
      .where(eq(milestoneReleases.milestoneId, milestoneId));
    return rows.map((r) => r.releaseId);
  }

  async deriveTargetDates(
    releaseIds: string[],
    _tenantId: string,
  ): Promise<{ startDate: string | null; endDate: string | null }> {
    if (releaseIds.length === 0) return { startDate: null, endDate: null };

    const rows = await this.db
      .select({
        startDate: releases.startDate,
        releaseDate: releases.releaseDate,
      })
      .from(releases)
      .where(sql`${releases.id} = ANY(${releaseIds})`);

    if (rows.length === 0) return { startDate: null, endDate: null };

    // Target start = earliest release startDate
    // Target end = latest release releaseDate or targetDate
    const starts: string[] = [];
    const ends: string[] = [];
    for (const r of rows) {
      if (r.startDate) starts.push(r.startDate);
      if (r.releaseDate) ends.push(r.releaseDate);
    }

    return {
      startDate: starts.length > 0 ? starts.sort()[0] : null,
      endDate: ends.length > 0 ? ends.sort().pop()! : null,
    };
  }
}