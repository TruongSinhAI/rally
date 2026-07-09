import { Injectable, Logger } from '@nestjs/common';
import type { JwtPayload } from '@platform';
import { InjectDrizzle } from '@platform';
import type { DrizzleDB } from '@platform';
import { and, eq, isNull, sql, inArray } from 'drizzle-orm';
import { workItems, iterations, releases } from '../../../../../../db/schema/work';
import type { DefectSeverity, DefectEnvironment } from '../../../../../../db/schema/enums';
import { ProjectsService } from '@modules/projects';
import type { DefectMetrics, DefectRow, DefectListResult } from '../domain/quality.types';

@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly projectsService: ProjectsService,
  ) {}

  async getDefects(
    actor: JwtPayload,
    projectId: string,
    opts: { search?: string; severity?: string; environment?: string; limit?: number; offset?: number } = {},
  ): Promise<DefectListResult> {
    await this.projectsService.getProject(actor.tenantId, projectId);

    const conditions = [
      eq(workItems.tenantId, actor.tenantId),
      eq(workItems.projectId, projectId),
      eq(workItems.type, 'defect'),
      isNull(workItems.deletedAt),
    ];

    if (opts.severity && opts.severity !== 'all') {
      conditions.push(eq(workItems.severity, opts.severity as DefectSeverity));
    }
    if (opts.environment && opts.environment !== 'all') {
      conditions.push(eq(workItems.foundInEnvironment, opts.environment as DefectEnvironment));
    }
    if (opts.search) {
      conditions.push(sql`work_items.title ILIKE ${`%${opts.search}%`}`);
    }

    const limit = Math.min(opts.limit ?? 100, 200);
    const offset = opts.offset ?? 0;

    // Fetch defects with LEFT JOINs for iteration/release/parent info
    const rows = await this.db
      .select({
        id: workItems.id,
        itemKey: workItems.itemKey,
        title: workItems.title,
        type: workItems.type,
        priority: workItems.priority,
        severity: workItems.severity,
        foundInEnvironment: workItems.foundInEnvironment,
        assigneeId: workItems.assigneeId,
        scheduleState: workItems.scheduleState,
        iterationId: workItems.iterationId,
        releaseId: workItems.releaseId,
        parentId: workItems.parentId,
        isBlocked: workItems.isBlocked,
        createdAt: workItems.createdAt,
        updatedAt: workItems.updatedAt,
        iterationName: iterations.name,
        releaseName: releases.name,
        parentKey: sql<string>`parent_wi.item_key`,
        parentTitle: sql<string>`parent_wi.title`,
      })
      .from(workItems)
      .leftJoin(iterations, eq(workItems.iterationId, iterations.id))
      .leftJoin(releases, eq(workItems.releaseId, releases.id))
      .leftJoin(sql`work.work_items parent_wi`, sql`parent_wi.id = work_items.parent_id`)
      .where(and(...conditions))
      .orderBy(workItems.createdAt)
      .limit(limit)
      .offset(offset);

    // Assignee names — batch fetch
    const assigneeIds = [...new Set(rows.map((r) => r.assigneeId).filter(Boolean))] as string[];
    let assigneeMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const users = await this.db
        .select({ id: sql<string>('id'), name: sql<string>('name') })
        .from(sql`identity.users`)
        .where(inArray(sql`id`, assigneeIds));
      assigneeMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
    }

    const data: DefectRow[] = rows.map((r) => ({
      id: r.id,
      itemKey: r.itemKey,
      title: r.title,
      type: r.type,
      priority: r.priority,
      severity: r.severity,
      foundInEnvironment: r.foundInEnvironment,
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeId ? (assigneeMap[r.assigneeId] ?? null) : null,
      scheduleState: r.scheduleState,
      iterationId: r.iterationId,
      iterationName: r.iterationName,
      releaseId: r.releaseId,
      releaseName: r.releaseName,
      parentId: r.parentId,
      parentKey: r.parentKey,
      parentTitle: r.parentTitle,
      isBlocked: r.isBlocked,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    // Metrics — compute from ALL defects (not just the page)
    const metrics = await this.computeMetrics(actor.tenantId, projectId);

    return { metrics, data };
  }

  private async computeMetrics(tenantId: string, projectId: string): Promise<DefectMetrics> {
    const rows = await this.db
      .select({
        scheduleState: workItems.scheduleState,
        severity: workItems.severity,
        isBlocked: workItems.isBlocked,
      })
      .from(workItems)
      .where(
        and(
          eq(workItems.tenantId, tenantId),
          eq(workItems.projectId, projectId),
          eq(workItems.type, 'defect'),
          isNull(workItems.deletedAt),
        ),
      );

    const open = ['defined', 'in_progress', 'testing'].includes.bind;
    let openDefects = 0;
    let critical = 0;
    let inTesting = 0;
    let verifiedAccepted = 0;
    let blockers = 0;

    for (const r of rows) {
      if (['defined', 'in_progress', 'testing'].includes(r.scheduleState)) openDefects++;
      if (r.severity === 'critical') critical++;
      if (r.scheduleState === 'in_progress') inTesting++; // testing mapped to in_progress in schedule state
      if (['completed', 'accepted'].includes(r.scheduleState)) verifiedAccepted++;
      if (r.isBlocked) blockers++;
    }

    return { openDefects, critical, inTesting, verifiedAccepted, reopened: 0, blockers };
  }
}