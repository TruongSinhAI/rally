/**
 * Quality/Defect API hooks — TanStack Query wrappers.
 */
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/api/http-client'
import { apiErrorMessage } from '@/shared/api/api-error'

export type DefectSeverity = 'critical' | 'high' | 'medium' | 'low'
export type DefectEnvironment = 'development' | 'staging' | 'production' | 'testing'

export interface DefectMetrics {
  openDefects: number
  critical: number
  inTesting: number
  verifiedAccepted: number
  reopened: number
  blockers: number
}

export interface DefectRow {
  id: string
  itemKey: string
  title: string
  type: string
  priority: string
  severity: DefectSeverity | null
  foundInEnvironment: DefectEnvironment | null
  assigneeId: string | null
  assigneeName: string | null
  scheduleState: string
  iterationId: string | null
  iterationName: string | null
  releaseId: string | null
  releaseName: string | null
  parentId: string | null
  parentKey: string | null
  parentTitle: string | null
  isBlocked: boolean
  createdAt: string
  updatedAt: string
}

export interface DefectListResult {
  metrics: DefectMetrics
  data: DefectRow[]
}

export const qualityKeys = {
  all: ['quality'] as const,
  defects: (projectId: string, filters?: Record<string, string>) =>
    [...qualityKeys.all, 'defects', projectId, filters] as const,
} as const

export function useDefects(
  projectId: string | undefined,
  filters?: { search?: string; severity?: string; environment?: string },
) {
  return useQuery({
    queryKey: qualityKeys.defects(projectId ?? '', filters as Record<string, string>),
    queryFn: async () => {
      if (!projectId) return { metrics: emptyMetrics(), data: [] } as DefectListResult
      const { data, error, response } = await apiClient.GET('/v1/quality/defects', {
        params: {
          query: {
            projectId,
            search: filters?.search,
            severity: filters?.severity,
            environment: filters?.environment,
          } as never,
        },
      })
      if (error) throw new Error(apiErrorMessage(error, response.status))
      return data as DefectListResult
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

function emptyMetrics(): DefectMetrics {
  return { openDefects: 0, critical: 0, inTesting: 0, verifiedAccepted: 0, reopened: 0, blockers: 0 }
}