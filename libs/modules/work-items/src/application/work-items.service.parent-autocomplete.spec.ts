import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkItemsService } from './work-items.service';
import { WORK_ITEM_REPOSITORY } from '../domain/ports/work-item.repository';
import { ACTIVITY_LOG_REPOSITORY } from '../domain/ports/activity-log.repository';
import { TIME_LOG_REPOSITORY } from '../domain/ports/time-log.repository';
import { WATCHER_REPOSITORY } from '../domain/ports/watcher.repository';
import { ATTACHMENT_REPOSITORY } from '../domain/ports/attachment.repository';
import { StorageService, NotFoundException, PreconditionFailedException } from '@platform';
import { ProjectsService } from '@modules/projects';
import { AccessService } from '@modules/access';
import type { WorkItem } from '../domain/work-item.types';
import { UnitOfWork } from '@platform/database/unit-of-work';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const now = new Date('2024-06-01');
const mockTx = { execute: vi.fn(), rollback: vi.fn(), commit: vi.fn() } as unknown as UnitOfWork;

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

const mockStatus = (id: string, isDefault = false) => ({
  id,
  name: id.replace('status-', ''),
  position: 0,
  isDefault,
  category: 'in_progress' as const,
});

// ── Mock factories ────────────────────────────────────────────────────────────

const makeWorkItemRepo = () => ({
  findById: vi.fn().mockResolvedValue(mockWorkItem()),
  create: vi.fn().mockImplementation(async (input) => mockWorkItem(input)),
  update: vi.fn().mockImplementation(async (id, patch) => mockWorkItem({ id, ...patch })),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ data: [], pageInfo: { nextCursor: null, hasNextPage: false, limit: 25 } }),
  findByIteration: vi.fn().mockResolvedValue({ data: [], pageInfo: { nextCursor: null, hasNextPage: false, limit: 25 } }),
  areAllTasksComplete: vi.fn().mockResolvedValue(false),
  countTasks: vi.fn().mockResolvedValue(0),
  getNextItemNo: vi.fn().mockResolvedValue(1),
  findChildren: vi.fn().mockResolvedValue([]),
});

const makeActivityRepo = () => ({
  appendMany: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ data: [] }),
});

const makeTimeLogRepo = () => ({ create: vi.fn(), update: vi.fn(), delete: vi.fn() });
const makeWatcherRepo = () => ({ subscribe: vi.fn(), unsubscribe: vi.fn(), list: vi.fn() });
const makeAttachmentRepo = () => ({ create: vi.fn(), confirm: vi.fn(), delete: vi.fn(), findById: vi.fn() });
const makeProjects = () => ({ getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }) });
const makeAccess = () => ({
  assertProjectPermission: vi.fn().mockResolvedValue(undefined),
  getUserRoleAndPermissions: vi.fn().mockResolvedValue({ role: 'member', permissions: ['work_item:edit'] }),
});
const makeUoW = () => ({ run: vi.fn(async (fn) => fn(mockTx)) });

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WorkItemsService — parent auto-complete business rule (report P1)', () => {
  let service: WorkItemsService;
  let workItemRepo: ReturnType<typeof makeWorkItemRepo>;
  let activityRepo: ReturnType<typeof makeActivityRepo>;

  beforeEach(async () => {
    workItemRepo = makeWorkItemRepo();
    activityRepo = makeActivityRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkItemsService,
        { provide: WORK_ITEM_REPOSITORY, useValue: workItemRepo },
        { provide: ACTIVITY_LOG_REPOSITORY, useValue: activityRepo },
        { provide: TIME_LOG_REPOSITORY, useValue: makeTimeLogRepo() },
        { provide: WATCHER_REPOSITORY, useValue: makeWatcherRepo() },
        { provide: ATTACHMENT_REPOSITORY, useValue: makeAttachmentRepo() },
        { provide: ProjectsService, useValue: makeProjects() },
        { provide: AccessService, useValue: makeAccess() },
        { provide: StorageService, useValue: { generatePresignedUrl: vi.fn() } },
        { provide: UnitOfWork, useValue: makeUoW() },
      ],
    }).compile();

    service = module.get(WorkItemsService);
  });

  it('auto-completes parent US/DE when the LAST incomplete child Task is completed', async () => {
    const parentId = 'parent-us-1';
    const lastTaskId = 'task-3';

    // Set up parent as a story with children
    const parent = mockWorkItem({ id: parentId, type: 'story', scheduleState: 'in_progress' });
    const lastTask = mockWorkItem({ id: lastTaskId, type: 'task', parentId, scheduleState: 'defined' });

    workItemRepo.findById.mockImplementation(async (id: string) => {
      if (id === lastTaskId) return lastTask;
      if (id === parentId) return parent;
      return null;
    });
    workItemRepo.areAllTasksComplete.mockResolvedValue(true);
    workItemRepo.update.mockImplementation(async (id, patch) => mockWorkItem({ id, ...patch }));

    // Complete the last task
    await service.updateWorkItem(mockActor, lastTaskId, { scheduleState: 'completed' });

    // Verify: areAllTasksComplete was checked
    expect(workItemRepo.areAllTasksComplete).toHaveBeenCalledWith(parentId, 'ws-1', mockTx);

    // Verify: parent was updated to 'completed'
    expect(workItemRepo.update).toHaveBeenCalledWith(
      parentId,
      expect.objectContaining({ scheduleState: 'completed' }),
      'ws-1',
      mockTx,
    );

    // Verify: activity log was created for the auto-completion
    expect(activityRepo.appendMany).toHaveBeenCalled();
  });

  it('does NOT auto-complete parent when a non-last child Task is completed', async () => {
    const parentId = 'parent-us-2';
    const completedTaskId = 'task-1';

    const parent = mockWorkItem({ id: parentId, type: 'story', scheduleState: 'in_progress' });
    const task = mockWorkItem({ id: completedTaskId, type: 'task', parentId, scheduleState: 'defined' });

    workItemRepo.findById.mockImplementation(async (id: string) => {
      if (id === completedTaskId) return task;
      if (id === parentId) return parent;
      return null;
    });
    // Simulate: 2 tasks exist, only 1 is completed → NOT all done
    workItemRepo.areAllTasksComplete.mockResolvedValue(false);

    await service.updateWorkItem(mockActor, completedTaskId, { scheduleState: 'completed' });

    // Verify: check was made
    expect(workItemRepo.areAllTasksComplete).toHaveBeenCalledWith(parentId, 'ws-1', mockTx);

    // Verify: parent was NOT updated
    expect(workItemRepo.update).not.toHaveBeenCalledWith(
      parentId,
      expect.objectContaining({ scheduleState: 'completed' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not attempt auto-complete for work items without a parent', async () => {
    const orphanTaskId = 'task-orphan';
    const task = mockWorkItem({ id: orphanTaskId, type: 'task', parentId: null, scheduleState: 'defined' });

    workItemRepo.findById.mockResolvedValue(task);

    await service.updateWorkItem(mockActor, orphanTaskId, { scheduleState: 'completed' });

    // areAllTasksComplete should NOT be called for orphan tasks
    expect(workItemRepo.areAllTasksComplete).not.toHaveBeenCalled();
  });

  it('does not auto-complete parent that is already completed', async () => {
    const parentId = 'parent-us-3';
    const taskId = 'task-x';

    const alreadyCompletedParent = mockWorkItem({ id: parentId, type: 'story', scheduleState: 'completed' });
    const task = mockWorkItem({ id: taskId, type: 'task', parentId, scheduleState: 'defined' });

    workItemRepo.findById.mockImplementation(async (id: string) => {
      if (id === taskId) return task;
      if (id === parentId) return alreadyCompletedParent;
      return null;
    });
    workItemRepo.areAllTasksComplete.mockResolvedValue(true);

    await service.updateWorkItem(mockActor, taskId, { scheduleState: 'completed' });

    // update on parent should NOT be called since it's already completed
    const parentUpdateCalls = workItemRepo.update.mock.calls.filter(
      (call) => call[0] === parentId,
    );
    expect(parentUpdateCalls).toHaveLength(0);
  });
});