import { describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkItemsService } from './work-items.service';
import { WORK_ITEM_REPOSITORY } from '../domain/ports/work-item.repository';
import { ACTIVITY_LOG_REPOSITORY } from '../domain/ports/activity-log.repository';
import { TIME_LOG_REPOSITORY } from '../domain/ports/time-log.repository';
import { WATCHER_REPOSITORY } from '../domain/ports/watcher.repository';
import { ATTACHMENT_REPOSITORY } from '../domain/ports/attachment.repository';
import { StorageService, PreconditionFailedException, UnitOfWork } from '@platform';
import { ProjectsService } from '@modules/projects';
import { AccessService } from '@modules/access';
import type { WorkItem } from '../domain/work-item.types';

/**
 * Report §4 Priority 3, Step 3.5 — Cross-project isolation tests.
 *
 * These tests verify that work items cannot be assigned to iterations or releases
 * that belong to a different project, both for single-item and bulk operations.
 * The `assertIterationAssignable` and `assertReleaseAssignable` private methods
 * enforce this at the service layer.
 */

const now = new Date('2024-06-01');

const mockWorkItem = (o: Partial<WorkItem> = {}): WorkItem => ({
  id: 'wi-1',
  workspaceId: 'ws-1',
  projectId: 'proj-1',
  itemKey: 'PROJ-1',
  type: 'story',
  title: 'Test story',
  description: null,
  statusId: 'status-todo',
  scheduleState: 'defined',
  priority: 'none',
  assigneeId: null,
  reporterId: null,
  parentId: null,
  teamId: null,
  iterationId: null,
  releaseId: null,
  storyPoints: null,
  estimateHours: null,
  todoHours: null,
  actualHours: null,
  acceptanceCriteria: null,
  notes: null,
  releaseNotes: null,
  isBlocked: false,
  blockedReason: null,
  rank: 'a1',
  customFields: {},
  createdBy: 'user-1',
  updatedBy: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  severity: null,
  foundInEnvironment: null,
  foundInReleaseId: null,
  rootCause: null,
  resolution: null,
  devOwnerId: null,
  defectState: null,
  fixedInBuild: null,
  ...o,
});

const mockActor = {
  sub: 'user-1',
  workspaceId: 'ws-1',
  contextId: 'ws-1',
  sessionId: 's1',
  jti: 'j1',
  iat: 0,
  exp: 0,
  iss: 'rally',
  aud: 'rally-app',
  permissions: ['work_item:edit'] as string[],
  claims: { permissions: ['work_item:edit'] },
  authMethod: 'password' as const,
};

const makeWorkItemRepo = () => ({
  findById: vi.fn().mockResolvedValue(mockWorkItem()),
  findByIds: vi.fn().mockResolvedValue([]),
  findIterationScope: vi.fn().mockResolvedValue(null),
  findReleaseProject: vi.fn().mockResolvedValue(null),
  assignIteration: vi.fn().mockResolvedValue(undefined),
  assignRelease: vi.fn().mockResolvedValue(undefined),
  listByProject: vi.fn(),
  listBacklog: vi.fn(),
  listTasksByParent: vi.fn().mockResolvedValue([]),
  findMaxRank: vi.fn().mockResolvedValue(null),
  getTaskTotals: vi.fn(),
  areAllTasksComplete: vi.fn().mockResolvedValue(false),
  countTasks: vi.fn().mockResolvedValue(0),
  create: vi.fn().mockImplementation(async (input) => mockWorkItem(input)),
  update: vi.fn().mockImplementation(async (id, patch) => mockWorkItem({ id, ...patch })),
  softDelete: vi.fn().mockResolvedValue(undefined),
  reorderItems: vi.fn().mockResolvedValue(undefined),
  addLabel: vi.fn().mockResolvedValue(undefined),
  removeLabel: vi.fn().mockResolvedValue(undefined),
  listLabels: vi.fn().mockResolvedValue([]),
  getNextItemNo: vi.fn().mockResolvedValue(1),
  findChildren: vi.fn().mockResolvedValue([]),
});

const makeModule = async (workItemRepo: ReturnType<typeof makeWorkItemRepo>) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      WorkItemsService,
      { provide: WORK_ITEM_REPOSITORY, useValue: workItemRepo },
      { provide: ACTIVITY_LOG_REPOSITORY, useValue: { appendMany: vi.fn(), list: vi.fn() } },
      { provide: TIME_LOG_REPOSITORY, useValue: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } },
      { provide: WATCHER_REPOSITORY, useValue: { subscribe: vi.fn(), unsubscribe: vi.fn(), list: vi.fn() } },
      { provide: ATTACHMENT_REPOSITORY, useValue: { create: vi.fn(), confirm: vi.fn(), delete: vi.fn(), findById: vi.fn() } },
      { provide: StorageService, useValue: { generatePresignedUrl: vi.fn() } },
      {
        provide: ProjectsService,
        useValue: {
          getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
          listStatuses: vi.fn().mockResolvedValue([]),
          assertTransitionAllowed: vi.fn().mockResolvedValue(undefined),
          generateItemKey: vi.fn().mockResolvedValue('PROJ-42'),
          listProjectTeams: vi.fn().mockResolvedValue([]),
          assertWorkspaceMember: vi.fn().mockResolvedValue(undefined),
          assertLabelBelongsToProject: vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: AccessService,
        useValue: {
          assertProjectPermission: vi.fn().mockResolvedValue(undefined),
          getUserRoleAndPermissions: vi.fn().mockResolvedValue({ role: 'member', permissions: ['work_item:edit'] }),
        },
      },
      { provide: UnitOfWork, useValue: { run: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})) } },
    ],
  }).compile();
  return module.get(WorkItemsService);
};

describe('WorkItemsService — cross-project isolation (report §4 step 3.5)', () => {
  it('single update: rejects assigning a work item to an iteration from a different project', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    // Item belongs to proj-1, but iteration it-x belongs to proj-2
    repo.findById.mockResolvedValue(mockWorkItem({ projectId: 'proj-1' }));
    repo.findIterationScope.mockResolvedValue({ projectId: 'proj-2', teamId: null });

    await expect(
      service.updateWorkItem(mockActor, 'wi-1', { iterationId: 'it-x' }),
    ).rejects.toThrow(PreconditionFailedException);

    // The iteration must NOT be assigned
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('single update: rejects assigning a work item to a team-scoped iteration from a different team', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    // Item has team-a, iteration has team-b (same project)
    repo.findById.mockResolvedValue(mockWorkItem({ projectId: 'proj-1', teamId: 'team-a' }));
    repo.findIterationScope.mockResolvedValue({ projectId: 'proj-1', teamId: 'team-b' });

    await expect(
      service.updateWorkItem(mockActor, 'wi-1', { iterationId: 'it-x' }),
    ).rejects.toThrow(PreconditionFailedException);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('single update: allows team-agnostic iteration (teamId=null) on a team-scoped item', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    repo.findById.mockResolvedValue(mockWorkItem({ projectId: 'proj-1', teamId: 'team-a' }));
    repo.findIterationScope.mockResolvedValue({ projectId: 'proj-1', teamId: null });
    repo.update.mockResolvedValue(mockWorkItem({ iterationId: 'it-x' }));

    const result = await service.updateWorkItem(mockActor, 'wi-1', { iterationId: 'it-x' });
    expect(result.iterationId).toBe('it-x');
    expect(repo.update).toHaveBeenCalled();
  });

  it('single update: rejects assigning a work item to a release from a different project', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    repo.findById.mockResolvedValue(mockWorkItem({ projectId: 'proj-1' }));
    repo.findReleaseProject.mockResolvedValue('proj-2');

    await expect(
      service.updateWorkItem(mockActor, 'wi-1', { releaseId: 'rel-x' }),
    ).rejects.toThrow(PreconditionFailedException);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('bulk iteration assign: rejects when iteration scope belongs to a different project', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    // Items belong to proj-1, but iteration it-x belongs to proj-2
    repo.findByIds.mockResolvedValue([
      mockWorkItem({ id: 'a', type: 'story', projectId: 'proj-1' }),
      mockWorkItem({ id: 'b', type: 'defect', projectId: 'proj-1' }),
    ]);
    repo.findIterationScope.mockResolvedValue({ projectId: 'proj-2', teamId: null });

    await expect(
      service.bulkAssignIteration(mockActor, 'proj-1', ['a', 'b'], 'it-x'),
    ).rejects.toThrow(PreconditionFailedException);

    // Assignment must NOT proceed
    expect(repo.assignIteration).not.toHaveBeenCalled();
  });

  it('bulk iteration assign: rejects when a team-scoped iteration mismatches any item team', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    // Iteration is scoped to team-b, but item 'a' has team-a
    repo.findByIds.mockResolvedValue([
      mockWorkItem({ id: 'a', type: 'story', projectId: 'proj-1', teamId: 'team-a' }),
    ]);
    repo.findIterationScope.mockResolvedValue({ projectId: 'proj-1', teamId: 'team-b' });

    await expect(
      service.bulkAssignIteration(mockActor, 'proj-1', ['a'], 'it-x'),
    ).rejects.toThrow(PreconditionFailedException);

    expect(repo.assignIteration).not.toHaveBeenCalled();
  });

  it('bulk release assign: rejects when release belongs to a different project', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    repo.findByIds.mockResolvedValue([
      mockWorkItem({ id: 'a', type: 'story', projectId: 'proj-1' }),
    ]);
    repo.findReleaseProject.mockResolvedValue('proj-2');

    await expect(
      service.bulkAssignRelease(mockActor, 'proj-1', ['a'], 'rel-x'),
    ).rejects.toThrow(PreconditionFailedException);

    expect(repo.assignRelease).not.toHaveBeenCalled();
  });

  it('bulk iteration unassign (null) skips scope validation entirely', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    repo.findByIds.mockResolvedValue([
      mockWorkItem({ id: 'a', type: 'story', projectId: 'proj-1' }),
    ]);

    const n = await service.bulkAssignIteration(mockActor, 'proj-1', ['a'], null);
    expect(n).toBe(1);

    // Scope lookup should NOT be called for null (unassign)
    expect(repo.findIterationScope).not.toHaveBeenCalled();
    expect(repo.assignIteration).toHaveBeenCalledWith(
      ['a'],
      null,
      'ws-1',
      'user-1',
      expect.anything(),
    );
  });

  it('create: rejects setting iterationId to an iteration from a different project', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    repo.findIterationScope.mockResolvedValue({ projectId: 'proj-2', teamId: null });

    await expect(
      service.createWorkItem(mockActor, 'proj-1', 'story', 'Cross-proj story', {
        iterationId: 'it-x',
      }),
    ).rejects.toThrow(PreconditionFailedException);

    // Item must NOT be created
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create: rejects setting releaseId to a release from a different project', async () => {
    const repo = makeWorkItemRepo();
    const service = await makeModule(repo);

    repo.findReleaseProject.mockResolvedValue('proj-2');

    await expect(
      service.createWorkItem(mockActor, 'proj-1', 'story', 'Cross-proj story', {
        releaseId: 'rel-x',
      }),
    ).rejects.toThrow(PreconditionFailedException);

    expect(repo.create).not.toHaveBeenCalled();
  });
});