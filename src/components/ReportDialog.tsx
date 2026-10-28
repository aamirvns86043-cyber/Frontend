import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Modal } from './Modal'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'

const reasons = ['Spam or misleading', 'Harassment or hate', 'Inappropriate content', 'Intellectual property', 'Something else']

export function ReportDialog() {
  const { reportTarget, closeReport, showToast } = useSocial()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  if (!reportTarget) return null
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reason) { showToast('Choose a reason to continue.'); return }
    setBusy(true)
    try {
      await api.post(endpoints.reports, { targetType: reportTarget.type, target: reportTarget.target, reason, details })
      closeReport(); setReason(''); setDetails('')
      showToast('Report sent. Thank you for helping keep Luma safe.')
    } catch (error) { showToast(errorMessage(error)) } finally { setBusy(false) }
  }
  return <Modal title={`Report ${reportTarget.label}`} eyebrow="Help us understand" onClose={closeReport} className="modal-sm">
    <form onSubmit={submit} className="modal-body form-stack">
      <div className="notice"><Flag size={18} /><p>Your report is confidential and goes to the Luma review team.</p></div>
      <fieldset><legend className="field-label">Select a reason</legend><div className="radio-list">{reasons.map(item => <label key={item} className={`radio-option ${reason === item ? 'selected' : ''}`}><input type="radio" name="reason" value={item} checked={reason === item} onChange={() => setReason(item)} />{item}</label>)}</div></fieldset>
      <label className="field"><span className="field-label">Additional details {reason === 'Something else' && '(required)'}</span><textarea value={details} onChange={event => setDetails(event.target.value.slice(0, 1000))} placeholder="Add context that may help the review team…" rows={4} required={reason === 'Something else'} /></label>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeReport}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button></div>
    </form>
  </Modal>
}
