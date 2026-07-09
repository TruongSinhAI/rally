/**
 * Quality / Defect Tracking — P3.4
 *
 * Shows defect metrics strip + filterable defect table for the active project.
 */
import { useState } from 'react'
import { AlertTriangle, Search, Filter, PackageOpen, Plus } from 'lucide-react'
import { SkeletonList } from '@/shared/ui/skeleton'
import { BRAND } from '@/shared/config/brand'
import { useAppContext } from '@/shared/lib/stores/app-context.store'
import { useAuthStore } from '@/shared/lib/stores/auth.store'
import { useDefects, type DefectSeverity } from '@/features/quality/api'

// ── Constants ──────────────────────────────────────────────────────────────

// (severity sort order applied inline)

const SEVERITY_STYLE: Record<DefectSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  high: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  medium: { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
  low: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
}

const STATE_LABEL: Record<string, string> = {
  defined: 'Defined',
  in_progress: 'In Progress',
  testing: 'Testing',
  completed: 'Completed',
  accepted: 'Accepted',
  released: 'Released',
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  urgent: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  high: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  normal: { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
  low: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  none: { bg: '#f1f5f9', text: '#8c94a6', border: '#e2e6eb' },
}

// ── Metric card ────────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col justify-center px-5 gap-0.5" style={{ borderLeft: `1px solid ${BRAND.border}` }}>
      <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#8c94a6' }}>
        {label}
      </span>
      <span className="text-[17px] font-semibold leading-none" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

// ── Quality page ───────────────────────────────────────────────────────────

export function QualityPage() {
  const { project } = useAppContext()
  const canManage = useAuthStore((s) => s.hasPermission('quality:manage'))
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [envFilter, setEnvFilter] = useState<string>('all')

  const { data, isLoading, error } = useDefects(project.projectId, {
    search: search || undefined,
    severity: severityFilter,
    environment: envFilter,
  })

  const defects = data?.data ?? []
  const metrics = data?.metrics ?? { openDefects: 0, critical: 0, inTesting: 0, verifiedAccepted: 0, reopened: 0, blockers: 0 }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 p-8">
        <AlertTriangle size={32} style={{ color: BRAND.danger }} />
        <p className="text-sm" style={{ color: '#5c6478' }}>
          {error instanceof Error ? error.message : 'Failed to load defects'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Metrics strip */}
      <div className="flex items-stretch bg-white shrink-0" style={{ borderBottom: `1px solid ${BRAND.border}`, height: 52 }}>
        <MetricCard label="Open Defects" value={metrics.openDefects} color="#8a5808" />
        <MetricCard label="Critical" value={metrics.critical} color="#b91c1c" />
        <MetricCard label="In Testing" value={metrics.inTesting} color="#7e22ce" />
        <MetricCard label="Verified / Accepted" value={metrics.verifiedAccepted} color="#1e6930" />
        <MetricCard label="Reopened" value={metrics.reopened} color="#1a2234" />
        <MetricCard label="Blockers" value={metrics.blockers} color={metrics.blockers > 0 ? '#b91c1c' : '#1a2234'} />
        <div className="flex-1" style={{ borderLeft: `1px solid ${BRAND.border}` }} />
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 bg-white shrink-0"
        style={{ borderBottom: `1px solid ${BRAND.border}` }}
      >
        <h2 className="text-[13px] font-semibold mr-2" style={{ color: '#1a2234' }}>
          Defects
        </h2>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8c94a6' }} />
          <input
            type="text"
            placeholder="Search defects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1 text-[11px] rounded focus:outline-none"
            style={{ backgroundColor: '#f4f6f9', border: `1px solid ${BRAND.border}`, color: '#1a2234', width: 160 }}
          />
        </div>
        <Filter size={13} style={{ color: '#8c94a6' }} />

        {/* Severity filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-[11px] rounded px-1.5 py-1 bg-white focus:outline-none"
          style={{ border: `1px solid ${BRAND.border}`, color: '#5c6478' }}
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Environment filter */}
        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="text-[11px] rounded px-1.5 py-1 bg-white focus:outline-none"
          style={{ border: `1px solid ${BRAND.border}`, color: '#5c6478' }}
        >
          <option value="all">All Environments</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
          <option value="testing">Testing</option>
        </select>

        <div className="flex-1" />

        {canManage && (
          <button
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-white rounded ml-1"
            style={{ backgroundColor: '#1d3f73' }}
          >
            <Plus size={12} />
            Log Defect
          </button>
        )}
      </div>

      {/* Defect table */}
      <div className="flex flex-1 overflow-hidden bg-white">
        {isLoading ? (
          <SkeletonList rows={8} className="p-4" />
        ) : defects.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8">
            <PackageOpen size={40} style={{ color: '#c4cad4' }} />
            <p className="text-sm" style={{ color: '#8c94a6' }}>
              {search || severityFilter !== 'all' || envFilter !== 'all'
                ? 'No defects match your filters'
                : 'No defects logged yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center h-8 px-3 gap-2 shrink-0 select-none"
              style={{ backgroundColor: '#f7f8fa', borderBottom: `1px solid ${BRAND.border}` }}
            >
              {['w-[68px] shrink-0', 'flex-1 min-w-0 pr-2', 'w-20 shrink-0', 'w-20 shrink-0', 'w-24 shrink-0', 'w-16 shrink-0', 'w-24 shrink-0', 'w-20 shrink-0', 'w-16 shrink-0', 'w-20 shrink-0'].map(
                (_, i) => (
                  <div
                    key={i}
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: '#8c94a6' }}
                  >
                    {['ID', 'Title', 'Severity', 'Priority', 'Environment', 'Owner', 'State', 'Sprint', 'Release', 'Updated'][i]}
                  </div>
                ),
              )}
            </div>
            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
              {defects.map((d) => {
                const sevStyle = d.severity ? SEVERITY_STYLE[d.severity] : null
                const priStyle = PRIORITY_STYLE[d.priority] ?? PRIORITY_STYLE.none

                return (
                  <div
                    key={d.id}
                    className="flex items-center h-8 px-3 gap-2 cursor-pointer"
                    style={{ borderBottom: '1px solid #edf0f4' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f7f8fa')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => window.open(`/work-items/${d.id}`, '_self')}
                  >
                    <div className="w-[68px] shrink-0 font-mono text-[10px]" style={{ color: '#5c6478' }}>
                      {d.itemKey}
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="block truncate text-[12px] font-medium" style={{ color: '#1a2234' }}>
                        {d.title}
                      </span>
                    </div>
                    <div className="w-20 shrink-0">
                      {sevStyle ? (
                        <span
                          className="inline-flex items-center px-1.5 py-px text-[10px] font-medium rounded-sm"
                          style={{ backgroundColor: sevStyle.bg, color: sevStyle.text, border: `1px solid ${sevStyle.border}` }}
                        >
                          {d.severity}
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: '#c4cad4' }}>—</span>
                      )}
                    </div>
                    <div className="w-20 shrink-0">
                      <span
                        className="inline-flex items-center px-1.5 py-px text-[10px] font-medium rounded-sm"
                        style={{ backgroundColor: priStyle.bg, color: priStyle.text, border: `1px solid ${priStyle.border}` }}
                      >
                        {d.priority === 'none' ? '—' : d.priority}
                      </span>
                    </div>
                    <div className="w-24 shrink-0 text-[10px] truncate capitalize" style={{ color: '#5c6478' }}>
                      {d.foundInEnvironment ?? '—'}
                    </div>
                    <div className="w-16 shrink-0 text-[10px]" style={{ color: '#5c6478' }}>
                      {d.assigneeName ?? '—'}
                    </div>
                    <div className="w-24 shrink-0">
                      <span className="inline-flex items-center px-1.5 py-px text-[10px] rounded-sm" style={{ backgroundColor: '#f7f8fa', color: '#5c6478', border: '1px solid #e2e6eb' }}>
                        {STATE_LABEL[d.scheduleState] ?? d.scheduleState}
                      </span>
                    </div>
                    <div className="w-20 shrink-0 text-[10px] truncate" style={{ color: '#5c6478' }}>
                      {d.iterationName ?? '—'}
                    </div>
                    <div className="w-16 shrink-0 text-[10px] truncate" style={{ color: '#5c6478' }}>
                      {d.releaseName ?? '—'}
                    </div>
                    <div className="w-20 shrink-0 text-[10px]" style={{ color: '#8c94a6' }}>
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}