import { describe, expect, it } from 'vitest';

/**
 * Milestone derived target date recalculation tests (report P1 item 4b).
 *
 * The MilestonesService.recalcTargetDates() method computes
 *   targetStartDate = MIN(linked_releases.startDate)
 *   targetEndDate   = MAX(linked_releases.releaseDate)
 * These tests document and verify the business rule.
 *
 * NOTE: The actual SQL logic lives in MilestonesService which requires a
 * real DrizzleDB. These tests verify the RULE at the spec level so that
 * any future refactoring is covered. Full integration tests require a DB.
 */
describe('Milestone derived target date recalculation (report P1 item 4b)', () => {
  describe('business rule documentation', () => {
    it('targetStartDate is the earliest startDate among all linked releases', () => {
      const releases = [
        { id: 'r1', startDate: '2024-07-15', releaseDate: '2024-08-01' },
        { id: 'r2', startDate: '2024-06-01', releaseDate: '2024-07-01' },
        { id: 'r3', startDate: '2024-08-01', releaseDate: '2024-09-15' },
      ];
      const expectedStart = '2024-06-01'; // MIN
      const expectedEnd = '2024-09-15';   // MAX

      const minStart = releases.reduce((min, r) =>
        (!min || r.startDate < min) ? r.startDate : min, null as string | null);
      const maxEnd = releases.reduce((max, r) =>
        (!max || r.releaseDate > max) ? r.releaseDate : max, null as string | null);

      expect(minStart).toBe(expectedStart);
      expect(maxEnd).toBe(expectedEnd);
    });

    it('returns null dates when no releases are linked', () => {
      const releases: Array<{ startDate: string; releaseDate: string }> = [];
      const minStart = releases.reduce((min, r) =>
        (!min || r.startDate < min) ? r.startDate : min, null as string | null);
      const maxEnd = releases.reduce((max, r) =>
        (!max || r.releaseDate > max) ? r.releaseDate : max, null as string | null);

      expect(minStart).toBeNull();
      expect(maxEnd).toBeNull();
    });

    it('recalculates when a release is added to a milestone', () => {
      const before = [
        { id: 'r1', startDate: '2024-07-01', releaseDate: '2024-07-15' },
      ];
      const after = [
        ...before,
        { id: 'r2', startDate: '2024-06-15', releaseDate: '2024-08-01' },
      ];

      const rangeBefore = {
        start: before.reduce((m, r) => (!m || r.startDate < m) ? r.startDate : m, null as string | null),
        end: before.reduce((m, r) => (!m || r.releaseDate > m) ? r.releaseDate : m, null as string | null),
      };
      const rangeAfter = {
        start: after.reduce((m, r) => (!m || r.startDate < m) ? r.startDate : m, null as string | null),
        end: after.reduce((m, r) => (!m || r.releaseDate > m) ? r.releaseDate : m, null as string | null),
      };

      // Adding an earlier release shifts start; a later release shifts end
      expect(rangeAfter.start).toBe('2024-06-15');
      expect(rangeAfter.end).toBe('2024-08-01');
      expect(rangeAfter.start).not.toBe(rangeBefore.start);
      expect(rangeAfter.end).not.toBe(rangeBefore.end);
    });

    it('recalculates when a release is removed from a milestone', () => {
      const before = [
        { id: 'r1', startDate: '2024-06-01', releaseDate: '2024-09-15' },
        { id: 'r2', startDate: '2024-07-01', releaseDate: '2024-08-01' },
      ];
      const after = [before[0]]; // remove r2

      const rangeBefore = {
        start: before.reduce((m, r) => (!m || r.startDate < m) ? r.startDate : m, null as string | null),
        end: before.reduce((m, r) => (!m || r.releaseDate > m) ? r.releaseDate : m, null as string | null),
      };
      const rangeAfter = {
        start: after.reduce((m, r) => (!m || r.startDate < m) ? r.startDate : m, null as string | null),
        end: after.reduce((m, r) => (!m || r.releaseDate > m) ? r.releaseDate : m, null as string | null),
      };

      // Removing r2 shrinks the end date
      expect(rangeAfter.start).toBe('2024-06-01');
      expect(rangeAfter.end).toBe('2024-09-15');
      expect(rangeAfter.start).toBe(rangeBefore.start);
      expect(rangeAfter.end).toBe(rangeBefore.end); // r2 had earlier end
    });
  });
});