export function Modal({ title, onClose, children }) {
  return (
    <div className="ui-modal-backdrop" onClick={onClose}>
      <div className="ui-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ui-modal-header">
          <h2>{title}</h2>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  )
}
