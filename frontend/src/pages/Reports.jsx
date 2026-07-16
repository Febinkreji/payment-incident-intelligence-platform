import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { downloadCsv, printReport } from '../utils/exportUtils'
import {
  buildRootCauseTrend,
  buildPspReport,
  buildRevenueImpactReport,
  buildSlaReport,
} from '../utils/reportsData'
import './Reports.css'

function ReportSection({ title, subtitle, onExport, children }) {
  return (
    <Card className="report-section">
      <div className="report-section-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {onExport && (
          <button type="button" className="report-export-button" onClick={onExport}>
            Export CSV
          </button>
        )}
      </div>
      {children}
    </Card>
  )
}

function DataTable({ columns, rows, rowKey }) {
  if (rows.length === 0) return <p className="ui-empty-state">No data.</p>
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((col) => (
                <td key={col.key}>{col.format ? col.format(row[col.key], row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Every section here is derived from the same GET /analytics + GET
// /incidents calls the Analytics page already makes — no new backend
// endpoints, no additional Firestore reads.
export function Reports() {
  const [analytics, setAnalytics] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let isMounted = true
    setStatus('loading')

    Promise.all([fetchJson('/analytics'), fetchJson('/incidents?pageSize=50')])
      .then(([analyticsData, incidentsPage]) => {
        if (!isMounted) return
        setAnalytics(analyticsData)
        setIncidents(incidentsPage.incidents)
        setStatus('success')
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [])

  const derived = useMemo(() => {
    if (!analytics) return null
    return {
      rootCauseTrend: buildRootCauseTrend(incidents),
      pspReport: buildPspReport(incidents),
      revenueImpact: buildRevenueImpactReport(incidents),
      slaReport: buildSlaReport(incidents),
    }
  }, [analytics, incidents])

  if (status === 'loading') {
    return (
      <div>
        <PageHeader title="Reports" subtitle="Operational reporting derived from existing analytics." />
        <p className="ui-empty-state">Loading reports…</p>
      </div>
    )
  }

  if (status === 'error' || !analytics || !derived) {
    return (
      <div>
        <PageHeader title="Reports" />
        <p className="ui-empty-state">Unable to load reports. Is the backend running?</p>
      </div>
    )
  }

  const last7 = analytics.incidentTrend.slice(-7)
  const last30 = analytics.incidentTrend.slice(-30)
  const today = analytics.incidentTrend[analytics.incidentTrend.length - 1]

  return (
    <div className="reports-page">
      <PageHeader
        title="Reports"
        subtitle="Daily, weekly, and monthly operational reporting derived from existing analytics."
        actions={
          <>
            <button type="button" className="report-export-button" onClick={printReport}>
              Print
            </button>
            <button type="button" className="report-export-button report-export-primary" onClick={printReport}>
              Export PDF
            </button>
          </>
        }
      />

      <div className="ui-grid ui-grid-3 report-summary-row">
        <Card className="report-summary-card">
          <span className="meta-label">Today</span>
          <strong>{today ? today.count : 0} incidents</strong>
        </Card>
        <Card className="report-summary-card">
          <span className="meta-label">Last 7 Days</span>
          <strong>{last7.reduce((sum, day) => sum + day.count, 0)} incidents</strong>
        </Card>
        <Card className="report-summary-card">
          <span className="meta-label">Last 30 Days</span>
          <strong>{last30.reduce((sum, day) => sum + day.count, 0)} incidents</strong>
        </Card>
      </div>

      <ReportSection title="Daily Report" subtitle="Incidents by day, most recent 14 days.">
        <DataTable
          rowKey="date"
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'count', label: 'Incidents' },
          ]}
          rows={analytics.incidentTrend.slice(-14)}
        />
      </ReportSection>

      <ReportSection title="Weekly Report" subtitle="Incidents by week (Monday start).">
        <DataTable
          rowKey="period"
          columns={[
            { key: 'period', label: 'Week Of' },
            { key: 'count', label: 'Incidents' },
          ]}
          rows={analytics.weeklyCounts}
        />
      </ReportSection>

      <ReportSection title="Monthly Report" subtitle="Incidents by month.">
        <DataTable
          rowKey="period"
          columns={[
            { key: 'period', label: 'Month' },
            { key: 'count', label: 'Incidents' },
          ]}
          rows={analytics.monthlyCounts}
        />
      </ReportSection>

      <ReportSection
        title="Incident Trend"
        subtitle="Full trend window from analytics."
        onExport={() =>
          downloadCsv('incident-trend', ['date', 'count'], analytics.incidentTrend)
        }
      >
        <DataTable
          rowKey="date"
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'count', label: 'Incidents' },
          ]}
          rows={analytics.incidentTrend.slice(-30)}
        />
      </ReportSection>

      <ReportSection
        title="Root Cause Trend"
        subtitle="Open and historical incidents grouped by root cause."
        onExport={() =>
          downloadCsv('root-cause-trend', ['rootCause', 'count'], derived.rootCauseTrend)
        }
      >
        <DataTable
          rowKey="rootCause"
          columns={[
            { key: 'rootCause', label: 'Root Cause' },
            { key: 'count', label: 'Incidents' },
          ]}
          rows={derived.rootCauseTrend}
        />
      </ReportSection>

      <ReportSection
        title="Merchant Report"
        subtitle="Incident volume and criticality by merchant."
        onExport={() =>
          downloadCsv(
            'merchant-report',
            ['merchant', 'incidentCount', 'criticalCount', 'openCount'],
            analytics.merchantHealth
          )
        }
      >
        <DataTable
          rowKey="merchant"
          columns={[
            { key: 'merchant', label: 'Merchant' },
            { key: 'incidentCount', label: 'Incidents' },
            { key: 'criticalCount', label: 'Critical' },
            { key: 'openCount', label: 'Open' },
          ]}
          rows={analytics.merchantHealth}
        />
      </ReportSection>

      <ReportSection
        title="PSP Report"
        subtitle="Incident volume by payment service provider."
        onExport={() => downloadCsv('psp-report', ['psp', 'incidents', 'critical'], derived.pspReport)}
      >
        <DataTable
          rowKey="psp"
          columns={[
            { key: 'psp', label: 'PSP' },
            { key: 'incidents', label: 'Incidents' },
            { key: 'critical', label: 'Critical' },
          ]}
          rows={derived.pspReport}
        />
      </ReportSection>

      <ReportSection
        title="Regional Report"
        subtitle="Incident volume and criticality by region."
        onExport={() =>
          downloadCsv(
            'regional-report',
            ['region', 'incidentCount', 'criticalCount', 'openCount'],
            analytics.regionHealth
          )
        }
      >
        <DataTable
          rowKey="region"
          columns={[
            { key: 'region', label: 'Region' },
            { key: 'incidentCount', label: 'Incidents' },
            { key: 'criticalCount', label: 'Critical' },
            { key: 'openCount', label: 'Open' },
          ]}
          rows={analytics.regionHealth}
        />
      </ReportSection>

      <ReportSection
        title="Revenue Impact"
        subtitle={`Estimated $${derived.revenueImpact.totalRevenueAtRisk.toLocaleString()} at risk across ${derived.revenueImpact.totalCustomersImpacted.toLocaleString()} customers.`}
        onExport={() =>
          downloadCsv(
            'revenue-impact',
            ['id', 'title', 'severity', 'revenueAtRisk', 'customersImpacted', 'successRate'],
            derived.revenueImpact.rows
          )
        }
      >
        <DataTable
          rowKey="id"
          columns={[
            { key: 'id', label: 'Incident' },
            { key: 'severity', label: 'Severity' },
            { key: 'revenueAtRisk', label: 'Revenue At Risk', format: (v) => `$${v.toLocaleString()}` },
            { key: 'customersImpacted', label: 'Customers' },
            { key: 'successRate', label: 'Success Rate', format: (v) => `${v.toFixed(1)}%` },
          ]}
          rows={derived.revenueImpact.rows.slice(0, 10)}
        />
      </ReportSection>

      <ReportSection
        title="SLA Report"
        subtitle={`${derived.slaReport.compliance}% of incidents within SLA (${derived.slaReport.breachedCount} breached).`}
        onExport={() =>
          downloadCsv(
            'sla-report',
            ['id', 'title', 'severity', 'status', 'level', 'isBreached'],
            derived.slaReport.rows
          )
        }
      >
        <DataTable
          rowKey="id"
          columns={[
            { key: 'id', label: 'Incident' },
            { key: 'severity', label: 'Severity' },
            { key: 'level', label: 'Escalation' },
            { key: 'isBreached', label: 'SLA Breached', format: (v) => (v ? 'Yes' : 'No') },
          ]}
          rows={derived.slaReport.rows.slice(0, 10)}
        />
      </ReportSection>
    </div>
  )
}
