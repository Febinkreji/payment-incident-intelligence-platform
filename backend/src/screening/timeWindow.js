// Time-window resolution for the Data Selection Layer. Kept separate from
// screeningRepository.js (which only knows how to run an already-bounded
// query) so "what does 'Last Hour' mean right now" is one single-responsibility
// concern, easy to reuse from both the engine and the controller's request
// parsing — and easy to extend with new presets without touching any query.

// Minutes per named preset. Deliberately data, not logic — every screening
// rule request threads a resolved {from, to} pair through explicitly; nothing
// in this feature ever hardcodes "15" or "60" inline the way a naive
// implementation might.
const WINDOW_PRESETS = {
  'last-15-minutes': 15,
  'last-30-minutes': 30,
  'last-hour': 60,
  'last-4-hours': 240,
}

const WINDOW_LABELS = {
  'last-15-minutes': 'Last 15 Minutes',
  'last-30-minutes': 'Last 30 Minutes',
  'last-hour': 'Last Hour',
  'last-4-hours': 'Last 4 Hours',
  today: 'Today',
}

const DEFAULT_PRESET = 'last-hour'

function startOfToday(reference) {
  const start = new Date(reference)
  start.setHours(0, 0, 0, 0)
  return start
}

// Resolves a request's time-window intent into concrete {from, to} bounds.
// Three ways to specify a window, in priority order:
//   1. An explicit custom range ({ from, to }) — the "future custom range"
//      requirement from the spec; supported from day one, not bolted on later.
//   2. A named preset ('last-15-minutes' | ... | 'today').
//   3. Nothing at all — falls back to DEFAULT_PRESET, never to an
//      unbounded/all-time scan.
// `reference` is injected (defaults to now) purely so this stays a pure,
// testable function rather than depending on an implicit ambient clock.
function resolveWindow({ preset, from, to, reference = new Date() } = {}) {
  if (from && to) {
    return { from: new Date(from), to: new Date(to), label: 'Custom Range' }
  }

  if (preset === 'today') {
    return { from: startOfToday(reference), to: reference, label: WINDOW_LABELS.today }
  }

  const resolvedPreset = WINDOW_PRESETS[preset] !== undefined ? preset : DEFAULT_PRESET
  const minutes = WINDOW_PRESETS[resolvedPreset]
  const to_ = reference
  const from_ = new Date(to_.getTime() - minutes * 60 * 1000)
  return { from: from_, to: to_, label: WINDOW_LABELS[resolvedPreset] }
}

module.exports = { WINDOW_PRESETS, WINDOW_LABELS, DEFAULT_PRESET, resolveWindow }
