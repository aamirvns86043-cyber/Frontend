import { Aperture } from 'lucide-react'
import { brand } from '@/config'

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className={`brand ${inverse ? 'brand-inverse' : ''}`} aria-label={brand.name}>
      <span className="brand-mark"><Aperture size={compact ? 19 : 22} strokeWidth={1.8} /></span>
      {!compact && <span className="brand-word">{brand.name}</span>}
    </span>
  )
}
