import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { IterationsService } from './iterations.service';
import { ITERATION_REPOSITORY } from '../domain/ports/iteration.repository';
import { DRIZZLE, PreconditionFailedException, ConflictException } from '@platform';
import { ProjectsService } from '@modules/projects';
import { AccessService } from '@modules/access';
import type { Iteration } from '../domain/iteration.types';

/**
 * Report §4 Priority 2, Step 2.5 / Gap G-16 — Iteration auto-acceptance verification.
 *
 * The Mini Rally spec (P2.3) states: "When all child Story/Defect items are Accepted,
 * the system should auto-set Iteration to Accepted."
 *
 * Current implementation: The `acceptIteration` method is a **manual** lifecycle action
 * (committed → accepted) invoked by the user. There is NO automatic trigger that
 * detects when all items in a committed iteration reach Accepted state and
 * auto-transitions the iteration.
 *
 * Sprint lifecycle management (start/close/cancel/capacity/carry-over) is intentionally
 * NOT implemented per project constraints. Auto-acceptance falls under that umbrella.
 *
 * These tests document the CURRENT manual behavior and the EXPECTED auto-acceptance
 * gap for future reference.
 */

const now = new Date('2024-06-01');

const mockIteration = (o: Partial<Iteration> = {}): Iteration => ({
  id: 'it-1',
  workspaceId: 'ws-1',
  projectId: 'proj-1',
  teamId: null,
  iterationKey: 'IT-1',
  name: 'Sprint 24.3',
  goal: null,
  theme: null,
  notes: null,
  state: 'planning',
  plannedVelocity: null,
  startDate: '2024-06-01',
  endDate: '2024-06-14',
  completedAt: null,
  createdAt: now,
  updatedAt: now,
  ...o,
});

const actor = { sub: 'user-1', workspaceId: 'ws-1' } as never;

describe('IterationsService — auto-acceptance gap documentation (report G-16)', () => {
  let service: IterationsService;
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    findCommitted: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repo = {
      findById: vi.fn(),
      findCommitted: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation((id, patch) =>
        Promise.resolve(mockIteration({ id, ...patch })),
      ),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IterationsService,
        { provide: ITERATION_REPOSITORY, useValue: repo },
        {
          provide: ProjectsService,
          useValue: {
            getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
            listProjectTeams: vi.fn().mockResolvedValue([{ teamId: 'team-1', status: 'active' }]),
          },
        },
        {
          provide: AccessService,
          useValue: { assertProjectPermission: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: DRIZZLE,
          useValue: {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get(IterationsService);
  });

  describe('current behavior: manual accept only', () => {
    it('acceptIteration requires explicit user action to move committed → accepted', async () => {
      repo.findById.mockResolvedValue(mockIteration({ state: 'committed' }));

      const result = await service.acceptIteration(actor, 'it-1');
      expect(result.state).toBe('accepted');
      expect(repo.update).toHaveBeenCalledWith('it-1', expect.objectContaining({ state: 'accepted' }));
    });

    it('rejects accepting an iteration that is still in planning state', async () => {
      repo.findById.mockResolvedValue(mockIteration({ state: 'planning' }));

      await expect(service.acceptIteration(actor, 'it-1')).rejects.toBeInstanceOf(
        PreconditionFailedException,
      );
    });

    it('enforces single-committed-iteration-per-project constraint', async () => {
      repo.findById.mockResolvedValue(mockIteration({ state: 'planning' }));
      repo.findCommitted.mockResolvedValue(mockIteration({ id: 'it-2', state: 'committed' }));

      await expect(service.commitIteration(actor, 'it-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('documented gap: no auto-acceptance on item completion', () => {
    it('documents that auto-acceptance is NOT implemented (G-16)', async () => {
      // This test serves as documentation. The IterationsService has no method
      // or event handler that checks whether all work items in a committed
      // iteration have reached Accepted state and auto-transitions the iteration.
      //
      // The acceptIteration method is purely manual. To implement auto-acceptance,
      // one would need either:
      // 1. A check in WorkItemsService.updateWorkItem after scheduleState changes,
      //    querying whether all sibling items in the same iteration are Accepted.
      // 2. A domain event listener on WorkItemStateChanged that aggregates and
      //    triggers auto-acceptance when the condition is met.
      //
      // This is intentionally deferred — Sprint lifecycle management is out of scope.
      expect(service.acceptIteration).toBeDefined();
      expect((service as unknown as Record<string, unknown>).autoAcceptIteration).toBeUndefined();
    });
  });
});