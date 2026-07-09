/**
 * Quality domain types — defect metrics and filtered list.
 */
import type { DefectSeverity, DefectEnvironment, WorkItemScheduleState } from '../../../../../db/schema/enums';

export interface DefectMetrics {
  openDefects: number;
  critical: number;
  inTesting: number;
  verifiedAccepted: number;
  reopened: number;
  blockers: number;
}

export interface DefectRow {
  id: string;
  itemKey: string;
  title: string;
  type: string;
  priority: string;
  severity: DefectSeverity | null;
  foundInEnvironment: DefectEnvironment | null;
  assigneeId: string | null;
  assigneeName: string | null;
  scheduleState: WorkItemScheduleState;
  iterationId: string | null;
  iterationName: string | null;
  releaseId: string | null;
  releaseName: string | null;
  parentId: string | null;
  parentKey: string | null;
  parentTitle: string | null;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DefectListResult {
  metrics: DefectMetrics;
  data: DefectRow[];
}