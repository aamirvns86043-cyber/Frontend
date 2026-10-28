import type { User } from '@/types/social'

export function Avatar({ user, size = 'md', ring = false, onClick, label }: { user: User; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; ring?: boolean; onClick?: () => void; label?: string }) {
  const content = <><img src={user.avatar} alt={`${user.name}'s profile`} /><span className="sr-only">{label ?? user.name}</span></>
  const className = `avatar avatar-${size} ${ring ? 'avatar-ring' : ''} ${onClick ? 'avatar-button' : ''}`
  return onClick ? <button type="button" className={className} onClick={onClick} aria-label={label ?? `View ${user.name}'s profile`}>{content}</button> : <span className={className}>{content}</span>
}
