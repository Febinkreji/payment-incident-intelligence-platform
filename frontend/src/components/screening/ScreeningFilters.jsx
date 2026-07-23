import { useEffect, useRef, useState } from 'react'
import { toDatetimeLocalInputValue } from '../../utils/screeningFormat'

const WINDOW_OPTIONS = [
  { value: 'last-15-minutes', label: 'Last 15 Minutes' },
  { value: 'last-30-minutes', label: 'Last 30 Minutes' },
  { value: 'last-hour', label: 'Last Hour' },
  { value: 'last-4-hours', label: 'Last 4 Hours' },
  { value: 'today', label: 'Today' },
  { value: 'custom', label: 'Custom Range' },
]

const PRIORITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const ENTITY_TYPE_OPTIONS = [
  { value: 'payment', label: 'Payment' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'order', label: 'Order' },
]

const SEARCH_DEBOUNCE_MS = 400

// Every field here reports up to Screening.jsx, which owns the canonical
// filter state that drives the backend call — this component holds only the
// ephemeral UI state a backend-driven filter bar still needs locally: the
// search box's debounce timer, and the custom-range inputs' in-progress
// draft (so a half-typed datetime doesn't fire a request on every keystroke).
export function ScreeningFilters({ filters, rules, rulesStatus, onChange }) {
  const [searchDraft, setSearchDraft] = useState(filters.search || '')
  const [rangeDraft, setRangeDraft] = useState({
    from: toDatetimeLocalInputValue(filters.from),
    to: toDatetimeLocalInputValue(filters.to),
  })
  const debounceRef = useRef(null)

  // No "Clear Filters" action exists yet that would reset filters.search
  // from outside this component — the only writer of that field today is
  // handleSearchChange below, which already keeps searchDraft in sync. If a
  // future external reset is added, sync it via the render-time
  // prev-value-comparison pattern (not a useEffect, which the project's
  // lint config flags as a cascading-render risk for setState-in-effect).
  function handleSearchChange(value) {
    setSearchDraft(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange({ search: value || undefined }), SEARCH_DEBOUNCE_MS)
  }

  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), [])

  function handlePresetChange(value) {
    if (value === 'custom') {
      onChange({ preset: undefined, from: rangeDraft.from || undefined, to: rangeDraft.to || undefined })
    } else {
      onChange({ preset: value, from: undefined, to: undefined })
    }
  }

  function handleApplyRange() {
    if (!rangeDraft.from || !rangeDraft.to) return
    onChange({
      preset: undefined,
      from: new Date(rangeDraft.from).toISOString(),
      to: new Date(rangeDraft.to).toISOString(),
    })
  }

  const isCustom = !filters.preset

  return (
    <div className="screening-filters">
      <div className="screening-filter-field">
        <label htmlFor="screening-filter-window">Time Window</label>
        <select
          id="screening-filter-window"
          value={isCustom ? 'custom' : filters.preset}
          onChange={(event) => handlePresetChange(event.target.value)}
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isCustom && (
        <div className="screening-filter-field screening-filter-range">
          <label htmlFor="screening-filter-from">From</label>
          <input
            id="screening-filter-from"
            type="datetime-local"
            value={rangeDraft.from}
            onChange={(event) => setRangeDraft((previous) => ({ ...previous, from: event.target.value }))}
          />
          <label htmlFor="screening-filter-to">To</label>
          <input
            id="screening-filter-to"
            type="datetime-local"
            value={rangeDraft.to}
            onChange={(event) => setRangeDraft((previous) => ({ ...previous, to: event.target.value }))}
          />
          <button type="button" className="screening-filter-apply-range" onClick={handleApplyRange}>
            Apply Range
          </button>
        </div>
      )}

      <div className="screening-filter-field">
        <label htmlFor="screening-filter-priority">Priority</label>
        <select
          id="screening-filter-priority"
          value={filters.priority || ''}
          onChange={(event) => onChange({ priority: event.target.value || undefined })}
        >
          <option value="">All</option>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="screening-filter-field">
        <label htmlFor="screening-filter-entity-type">Entity Type</label>
        <select
          id="screening-filter-entity-type"
          value={filters.entityType || ''}
          onChange={(event) => onChange({ entityType: event.target.value || undefined })}
        >
          <option value="">All</option>
          {ENTITY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="screening-filter-field">
        <label htmlFor="screening-filter-rules">Rules</label>
        <select
          id="screening-filter-rules"
          multiple
          className="screening-filter-rules-select"
          value={filters.ruleIds || []}
          disabled={rulesStatus !== 'success'}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions, (option) => option.value)
            onChange({ ruleIds: selected.length > 0 ? selected : undefined })
          }}
        >
          {(rules || []).map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="screening-filter-field screening-filter-search">
        <label htmlFor="screening-filter-search">Search</label>
        <input
          id="screening-filter-search"
          type="text"
          placeholder="Entity ID, rule name, or reason…"
          value={searchDraft}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
      </div>
    </div>
  )
}
