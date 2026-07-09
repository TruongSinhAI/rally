/**
 * Milestones API hooks — TanStack Query wrappers.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/shared/api/http-client'
import { apiErrorMessage } from '@/shared/api/api-error'

export type MilestoneStatus = 'planned' | 'at_risk' | 'met' | 'missed' | 'cancelled' | 'completed'

export interface Milestone {
  id: string
  tenantId: string
  projectId: string
  name: string
  description: string | null
  notes: string | null
  status: MilestoneStatus
  ownerId: string | null
  targetStartDate: string | null
  targetEndDate: string | null
  releaseIds: string[]
  createdAt: string
  updatedAt: string
}

export const milestoneKeys = {
  all: ['milestones'] as const,
  list: (projectId: string) => [...milestoneKeys.all, 'list', projectId] as const,
  detail: (id: string) => [...milestoneKeys.all, 'detail', id] as const,
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = apiClient as any

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: milestoneKeys.list(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) return []
      const { data, error, response } = await client.GET('/v1/milestones', {
        params: { query: { projectId } },
      })
      if (error) throw new Error(apiErrorMessage(error, response.status))
      return ((data as { data?: Milestone[] } | undefined)?.data ?? []) as Milestone[]
    },
    enabled: !!projectId,
    staleTime: 60_000,
  })
}

export function useMilestone(id: string | undefined) {
  return useQuery({
    queryKey: milestoneKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null
      const { data, error, response } = await client.GET('/v1/milestones/{id}', {
        params: { path: { id } },
      })
      if (error) throw new Error(apiErrorMessage(error, response.status))
      return data as unknown as Milestone
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

export interface CreateMilestoneInput {
  projectId: string
  name: string
  description?: string
  notes?: string
  status?: MilestoneStatus
  ownerId?: string
  releaseIds?: string[]
}

export function useCreateMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateMilestoneInput) => {
      const { data, error, response } = await client.POST('/v1/milestones', {
        body: body as never,
      })
      if (error) throw new Error(apiErrorMessage(error, response.status))
      return data as unknown as Milestone
    },
    onSuccess: (milestone: Milestone) => {
      void qc.invalidateQueries({ queryKey: milestoneKeys.list(milestone.projectId) })
    },
  })
}

export interface UpdateMilestoneInput {
  name?: string
  description?: string | null
  notes?: string | null
  status?: MilestoneStatus
  ownerId?: string | null
  releaseIds?: string[]
}

export function useUpdateMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateMilestoneInput & { id: string }) => {
      const { data, error, response } = await client.PATCH('/v1/milestones/{id}', {
        params: { path: { id } },
        body: body as never,
      })
      if (error) throw new Error(apiErrorMessage(error, response.status))
      return data as unknown as Milestone
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: milestoneKeys.all })
    },
  })
}

export function useDeleteMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await client.DELETE('/v1/milestones/{id}', {
        params: { path: { id } },
      })
      if (error) throw new Error(apiErrorMessage(error, response.status))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: milestoneKeys.all })
    },
  })
}