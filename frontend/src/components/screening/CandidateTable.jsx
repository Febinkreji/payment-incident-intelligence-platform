import { useState, useCallback } from 'react'
import { CandidateRow } from './CandidateRow'

const COLUMNS = [
  'Priority',
  'Confidence',
  'Entity Type',
  'Entity ID',
  'Matched Rules',
  'Reason',
  'Evidence Summary',
  'Entity Timestamp',
  'Screening Timestamp',
  'Recommended Next Action',
  '',
]

function entityKey(candidate) {
  return `${candidate.entityType}:${candidate.entityId}`
}

export function CandidateTable({ candidates, onInvestigate }) {
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())

  const toggleExpanded = useCallback((key) => {
    setExpandedKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="screening-table-scroll">
      <table className="screening-table">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column || 'actions'}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const key = entityKey(candidate)
            return (
              <CandidateRow
                key={key}
                candidate={candidate}
                expanded={expandedKeys.has(key)}
                onToggleExpand={() => toggleExpanded(key)}
                onInvestigate={onInvestigate}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
