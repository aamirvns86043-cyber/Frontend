import { Check, ChevronRight } from 'lucide-react'

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'toggle-on' : ''}`} onClick={() => onChange(!checked)}><span /></button>
}

export function SettingRow({ icon: Icon, title, description, onClick, trailing, danger = false }: { icon?: React.ComponentType<{ size?: number }>; title: string; description?: string; onClick?: () => void; trailing?: React.ReactNode; danger?: boolean }) {
  const content = <>{Icon && <span className="setting-icon"><Icon size={19} /></span>}<span className="setting-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span><span className="setting-trailing">{trailing ?? <ChevronRight size={18} />}</span></>
  return onClick ? <button type="button" className={`setting-row ${danger ? 'danger-text' : ''}`} onClick={onClick}>{content}</button> : <div className={`setting-row ${danger ? 'danger-text' : ''}`}>{content}</div>
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" className={`check-box ${checked ? 'checked' : ''}`} onClick={onChange} aria-pressed={checked} aria-label={label}>{checked && <Check size={13} />}</button>
}
