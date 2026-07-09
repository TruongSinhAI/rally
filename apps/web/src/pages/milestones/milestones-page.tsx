/**
 * Milestones — P3.3
 *
 * Lists milestones for the active project. Milestones live under
 * Plan > Timeboxes alongside Iterations and Releases.
 */
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Plus, Search, Pencil, Trash2, PackageOpen } from 'lucide-react'
import { SkeletonList } from '@/shared/ui/skeleton'
import { BRAND } from '@/shared/config/brand'
import { AppModal, ModalBody, ModalFooter } from '@/shared/ui/app-modal'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'
import { useAppContext } from '@/shared/lib/stores/app-context.store'
import { useAuthStore } from '@/shared/lib/stores/auth.store'
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  type Milestone,
  type MilestoneStatus,
} from '@/features/milestones/api'
import { useReleases } from '@/features/releases/api'

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<MilestoneStatus, { bg: string; text: string; border: string; label: string }> = {
  planned: { bg: '#eef3fb', text: '#475569', border: '#cbd5e1', label: 'Planned' },
  at_risk: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa', label: 'At Risk' },
  met: { bg: '#eaf5ed', text: '#1e6930', border: '#b9dec2', label: 'Met' },
  missed: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'Missed' },
  cancelled: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: 'Cancelled' },
  completed: { bg: '#eef6f0', text: '#1e6930', border: '#a8d5b3', label: 'Completed' },
}

function StatusBadge({ status }: { status: MilestoneStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.planned
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-px text-[11px] font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  )
}

const MILESTONE_STATUSES: MilestoneStatus[] = ['planned', 'at_risk', 'met', 'missed', 'cancelled', 'completed']

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateMilestoneModal({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<MilestoneStatus>('planned')
  const create = useCreateMilestone()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await create.mutateAsync({
        projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      })
      toast.success(`Milestone "${name}" created`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create milestone')
    }
  }

  return (
    <AppModal open onClose={onClose} title="New Milestone" width={460}>
      <form onSubmit={(e) => { void handleSubmit(e) }}>
        <ModalBody className="space-y-4">
          <FormField label="Milestone name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Release Candidate"
              autoFocus
            />
          </FormField>
          <FormField label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: BRAND.border, color: '#1a2234' }}
            >
              {MILESTONE_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Milestone description..."
              rows={3}
            />
          </FormField>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md"
            style={{ border: `1px solid ${BRAND.border}`, color: '#5c6478' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending || !name.trim()}
            className="px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50"
            style={{ backgroundColor: BRAND.primary }}
          >
            {create.isPending ? 'Creating...' : 'Create Milestone'}
          </button>
        </ModalFooter>
      </form>
    </AppModal>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditMilestoneModal({
  milestone,
  onClose,
}: {
  milestone: Milestone
  onClose: () => void
}) {
  const [name, setName] = useState(milestone.name)
  const [description, setDescription] = useState(milestone.description ?? '')
  const [status, setStatus] = useState<MilestoneStatus>(milestone.status)
  const update = useUpdateMilestone()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await update.mutateAsync({
        id: milestone.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
      })
      toast.success(`Milestone updated`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update milestone')
    }
  }

  return (
    <AppModal open onClose={onClose} title="Edit Milestone" width={460}>
      <form onSubmit={(e) => { void handleSubmit(e) }}>
        <ModalBody className="space-y-4">
          <FormField label="Milestone name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Milestone name"
              autoFocus
            />
          </FormField>
          <FormField label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: BRAND.border, color: '#1a2234' }}
            >
              {MILESTONE_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Milestone description..."
              rows={3}
            />
          </FormField>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md"
            style={{ border: `1px solid ${BRAND.border}`, color: '#5c6478' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={update.isPending || !name.trim()}
            className="px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50"
            style={{ backgroundColor: BRAND.primary }}
          >
            {update.isPending ? 'Saving...' : 'Save'}
          </button>
        </ModalFooter>
      </form>
    </AppModal>
  )
}

// ── Milestones page ───────────────────────────────────────────────────────────

export function MilestonesPage() {
  const { project } = useAppContext()
  const canManage = useAuthStore((s) => s.hasPermission('milestone:manage'))
  const { data: milestones, isLoading, error } = useMilestones(project?.projectId)
  const deleteMilestone = useDeleteMilestone()
  const { data: releases } = useReleases(project?.projectId)

  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Milestone | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!milestones) return []
    const q = search.toLowerCase()
    return milestones.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q),
    )
  }, [milestones, search])

  const releaseMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of releases ?? []) {
      map.set(r.id, r.name)
    }
    return map
  }, [releases])

  async function handleDelete(id: string) {
    try {
      await deleteMilestone.mutateAsync(id)
      toast.success('Milestone deleted')
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 p-8">
        <AlertTriangle size={32} style={{ color: BRAND.danger }} />
        <p className="text-sm" style={{ color: '#5c6478' }}>
          {error instanceof Error ? error.message : 'Failed to load milestones'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2 bg-white shrink-0"
        style={{ borderBottom: `1px solid ${BRAND.border}` }}
      >
        <h2 className="text-sm font-semibold mr-2" style={{ color: '#1a2234' }}>
          Milestones
        </h2>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#8c94a6' }} />
          <input
            type="text"
            placeholder="Search milestones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-md focus:outline-none"
            style={{
              backgroundColor: '#f4f6f9',
              border: `1px solid ${BRAND.border}`,
              color: '#1a2234',
              width: 200,
            }}
          />
        </div>
        <div className="flex-1" />
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md"
            style={{ backgroundColor: BRAND.primary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.primaryHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND.primary)}
          >
            <Plus size={14} />
            New Milestone
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex flex-1 overflow-hidden bg-white">
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8">
            <PackageOpen size={40} style={{ color: '#c4cad4' }} />
            <p className="text-sm" style={{ color: '#8c94a6' }}>
              {search ? 'No milestones match your search' : 'No milestones yet'}
            </p>
            {canManage && !search && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Plus size={14} />
                Create Milestone
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr
                  className="text-[9px] font-semibold uppercase tracking-wider select-none"
                  style={{ backgroundColor: '#f7f8fa', borderBottom: `1px solid ${BRAND.border}` }}
                >
                  <th className="h-8 px-3 font-medium" style={{ color: '#8c94a6' }}>Name</th>
                  <th className="h-8 px-3 font-medium" style={{ color: '#8c94a6' }}>Status</th>
                  <th className="h-8 px-3 font-medium" style={{ color: '#8c94a6' }}>Target Start</th>
                  <th className="h-8 px-3 font-medium" style={{ color: '#8c94a6' }}>Target End</th>
                  <th className="h-8 px-3 font-medium" style={{ color: '#8c94a6' }}>Releases</th>
                  <th className="h-8 px-3 font-medium w-24" style={{ color: '#8c94a6' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((ms) => (
                  <tr
                    key={ms.id}
                    className="cursor-pointer"
                    style={{ borderBottom: `1px solid #edf0f4` }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f7f8fa')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setEditing(ms)}
                  >
                    <td className="h-8 px-3">
                      <span className="text-xs font-medium truncate block max-w-[260px]" style={{ color: '#1a2234' }}>
                        {ms.name}
                      </span>
                    </td>
                    <td className="h-8 px-3">
                      <StatusBadge status={ms.status} />
                    </td>
                    <td className="h-8 px-3 text-xs" style={{ color: '#5c6478' }}>
                      {ms.targetStartDate ?? '\u2014'}
                    </td>
                    <td className="h-8 px-3 text-xs" style={{ color: '#5c6478' }}>
                      {ms.targetEndDate ?? '\u2014'}
                    </td>
                    <td className="h-8 px-3">
                      <span className="text-xs" style={{ color: '#2558a6' }}>
                        {ms.releaseIds.length > 0
                          ? ms.releaseIds.map((rid) => releaseMap.get(rid) ?? rid.slice(0, 8)).join(', ')
                          : '\u2014'}
                      </span>
                    </td>
                    <td className="h-8 px-3">
                      {canManage && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditing(ms)}
                            className="p-1 rounded hover:bg-gray-100"
                            title="Edit"
                          >
                            <Pencil size={13} style={{ color: '#5c6478' }} />
                          </button>
                          {deleting === ms.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { void handleDelete(ms.id) }}
                                className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                                style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleting(null)}
                                className="px-1.5 py-0.5 text-[10px] rounded"
                                style={{ border: `1px solid ${BRAND.border}`, color: '#5c6478' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleting(ms.id)}
                              className="p-1 rounded hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 size={13} style={{ color: '#b91c1c' }} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateMilestoneModal
          projectId={project?.projectId ?? ''}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <EditMilestoneModal
          milestone={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}