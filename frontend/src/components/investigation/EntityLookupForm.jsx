import { useState } from 'react'
import './investigation.css'

const TYPE_OPTIONS = [
  { value: 'order', label: 'Order ID' },
  { value: 'payment', label: 'Payment ID' },
  { value: 'terminal', label: 'Terminal ID' },
]

export function EntityLookupForm({ onSubmit, isLoading }) {
  const [type, setType] = useState('order')
  const [value, setValue] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(type, trimmed)
  }

  return (
    <form className="investigation-lookup-form" onSubmit={handleSubmit}>
      <div className="investigation-lookup-field">
        <label htmlFor="investigation-lookup-type">Lookup by</label>
        <select
          id="investigation-lookup-type"
          className="investigation-lookup-select"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="investigation-lookup-field">
        <label htmlFor="investigation-lookup-value">Identifier</label>
        <input
          id="investigation-lookup-value"
          className="investigation-lookup-input"
          type="text"
          placeholder="e.g. 8436c621fc4908f2110b"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>

      <button type="submit" className="investigation-lookup-submit" disabled={isLoading || !value.trim()}>
        {isLoading ? 'Investigating…' : 'Investigate'}
      </button>
    </form>
  )
}
