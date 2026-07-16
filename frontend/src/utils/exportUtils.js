// Client-side only — builds a CSV Blob from already-fetched data and
// triggers a browser download. No network request, no backend endpoint.
export function downloadCsv(filename, headers, rows) {
  const escapeCell = (value) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const lines = [headers.map(escapeCell).join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','))
  })

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// "Export PDF" uses the browser's native print-to-PDF via window.print() —
// no PDF-generation library, no server round trip. A print stylesheet hides
// the sidebar/header chrome so only the report content renders.
export function printReport() {
  window.print()
}
