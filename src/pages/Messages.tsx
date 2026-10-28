import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MessageCircle, MoreHorizontal, Search, Send, Smile, SquarePen, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useSocial } from '@/hooks/use-social'
import { api, endpoints, errorMessage } from '@/lib/api'
import type { Conversation, Message, User } from '@/types/social'

type MessagePage = { messages: Message[]; hasMore: boolean }
const byRecent = (a: Conversation, b: Conversation) => b.lastMessageAt.localeCompare(a.lastMessageAt)

export default function Messages() {
  const { viewProfile, openReport, pendingChat, clearPendingChat, refreshCounts, showToast } = useSocial()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatQuery, setNewChatQuery] = useState('')
  const [newChatResults, setNewChatResults] = useState<User[]>([])
  const [searchChat, setSearchChat] = useState(false)
  const [chatQuery, setChatQuery] = useState('')
  const messagesRef = useRef<Message[]>([])
  const bodyRef = useRef<HTMLDivElement>(null)
  const selected = conversations.find(item => item.id === selectedId) ?? null
  const filtered = useMemo(() => conversations.filter(item => `${item.user.name} ${item.user.username}`.toLowerCase().includes(query.toLowerCase())), [conversations, query])

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { const body = bodyRef.current; if (body) body.scrollTop = body.scrollHeight }, [messages.length, selectedId])

  const loadInbox = useCallback(async () => {
    try {
      const res = await api.get<{ conversations: Conversation[] }>(endpoints.conversations)
      // keep chats I just started that have no message yet (the server only lists chats with messages)
      setConversations(previous => [...previous.filter(item => !item.lastMessage && !res.conversations.some(c => c.id === item.id)), ...res.conversations])
    } catch (reason) { showToast(errorMessage(reason)) } finally { setLoadingInbox(false) }
  }, [showToast])
  useEffect(() => {
    loadInbox()
    const timer = window.setInterval(loadInbox, 15000)
    return () => window.clearInterval(timer)
  }, [loadInbox])

  const openChat = useCallback(async (id: string) => {
    setSelectedId(id); setChatOpen(true); setSearchChat(false); setChatQuery(''); setMessages([]); setHasMore(false); setLoadingMessages(true)
    try {
      const res = await api.get<MessagePage>(`${endpoints.conversations}/${id}/messages?limit=50`)
      setMessages(res.messages); setHasMore(res.hasMore)
      setConversations(items => items.map(item => item.id === id ? { ...item, unread: 0 } : item))
      refreshCounts()
    } catch (reason) { showToast(errorMessage(reason)) } finally { setLoadingMessages(false) }
  }, [refreshCounts, showToast])

  // opened from a profile ("Message" button)
  useEffect(() => {
    if (!pendingChat) return
    setConversations(items => items.some(item => item.id === pendingChat.id) ? items : [pendingChat, ...items])
    openChat(pendingChat.id)
    clearPendingChat()
  }, [pendingChat, openChat, clearPendingChat])

  // no websockets yet: ask for new messages every few seconds while a chat is open
  useEffect(() => {
    if (!selectedId) return
    const timer = window.setInterval(async () => {
      const last = messagesRef.current[messagesRef.current.length - 1]
      try {
        const res = await api.get<MessagePage>(`${endpoints.conversations}/${selectedId}/messages?limit=50${last ? `&after=${last.id}` : ''}`)
        if (!res.messages.length) return
        setMessages(previous => last ? [...previous, ...res.messages.filter(item => !previous.some(p => p.id === item.id))] : res.messages)
      } catch { /* try again on the next tick */ }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [selectedId])

  useEffect(() => {
    if (!newChatOpen || !newChatQuery.trim()) { setNewChatResults([]); return }
    let cancelled = false
    const timer = window.setTimeout(() => {
      api.get<{ users: User[] }>(`${endpoints.search}?q=${encodeURIComponent(newChatQuery.trim())}`).then(res => { if (!cancelled) setNewChatResults(res.users) }).catch(() => {})
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [newChatOpen, newChatQuery])

  const startChat = async (user: User) => {
    try {
      const res = await api.post<{ conversation: Conversation }>(endpoints.conversations, { username: user.username })
      setConversations(items => items.some(item => item.id === res.conversation.id) ? items : [res.conversation, ...items])
      setNewChatOpen(false); setNewChatQuery('')
      openChat(res.conversation.id)
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const loadEarlier = async () => {
    if (!selectedId || !messages.length) return
    try {
      const res = await api.get<MessagePage>(`${endpoints.conversations}/${selectedId}/messages?limit=50&before=${messages[0].id}`)
      setMessages(previous => [...res.messages, ...previous]); setHasMore(res.hasMore)
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = message.trim()
    if (!text || !selected || sending) return
    setSending(true)
    try {
      const res = await api.post<{ message: Message }>(`${endpoints.conversations}/${selected.id}/messages`, { text })
      setMessages(previous => [...previous, res.message]); setMessage('')
      setConversations(items => items.map(item => item.id === selected.id ? { ...item, lastMessage: text, lastSender: 'me' as const, time: 'now', lastMessageAt: res.message.createdAt } : item).sort(byRecent))
    } catch (reason) { showToast(errorMessage(reason)) } finally { setSending(false) }
  }
  const react = async (item: Message) => {
    if (!selected || item.deleted) return
    try {
      const res = await api.put<{ message: Message }>(`${endpoints.conversations}/${selected.id}/messages/${item.id}/reaction`, { emoji: item.reaction ? '' : '❤️' })
      setMessages(previous => previous.map(m => m.id === item.id ? res.message : m))
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const remove = async (item: Message) => {
    if (!selected) return
    try {
      const res = await api.del<{ message: Message }>(`${endpoints.conversations}/${selected.id}/messages/${item.id}`)
      setMessages(previous => previous.map(m => m.id === item.id ? res.message : m))
    } catch (reason) { showToast(errorMessage(reason)) }
  }
  const visibleMessages = messages.filter(item => !chatQuery || item.text.toLowerCase().includes(chatQuery.toLowerCase()))

  return <div className={`messages-page page-enter ${chatOpen ? 'chat-open' : ''}`}>
    <aside className="inbox-panel">
      <div className="inbox-heading"><div><p className="eyebrow">YOUR SPACE</p><h1>Messages</h1></div><button type="button" className="icon-button bordered" onClick={() => setNewChatOpen(!newChatOpen)} aria-label="New message"><SquarePen size={19} /></button></div>
      {newChatOpen && <div className="new-chat"><label className="inbox-search"><Search size={18} /><input autoFocus value={newChatQuery} onChange={event => setNewChatQuery(event.target.value)} placeholder="Find someone to message" /></label>{newChatResults.map(user => <button type="button" key={user.id} className="conversation" onClick={() => startChat(user)}><span className="conversation-avatar"><Avatar user={user} size="md" /></span><span className="conversation-copy"><strong>{user.name}</strong><span>@{user.username}</span></span></button>)}{newChatQuery.trim() && !newChatResults.length && <p className="empty-copy">No people found.</p>}</div>}
      <label className="inbox-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search conversations" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear inbox search"><X size={15} /></button>}</label>
      <div className="conversation-list">{filtered.length ? filtered.map(conversation => <button type="button" key={conversation.id} className={`conversation ${selectedId === conversation.id ? 'active' : ''}`} onClick={() => openChat(conversation.id)}><span className="conversation-avatar"><Avatar user={conversation.user} size="md" />{conversation.user.online && <i />}</span><span className="conversation-copy"><strong>{conversation.user.name}</strong><span>{conversation.lastMessage ? `${conversation.lastSender === 'me' ? 'You: ' : ''}${conversation.lastMessage} · ${conversation.time}` : 'Say hello 👋'}</span></span>{conversation.unread > 0 && <span className="unread-count">{conversation.unread}</span>}</button>) : loadingInbox ? <div className="inbox-empty"><span className="loading-spinner" /></div> : <div className="inbox-empty"><MessageCircle size={25} /><h3>{query ? 'No conversations found' : 'No messages yet'}</h3><p>{query ? 'Try another name or username.' : 'Tap the pencil to start a conversation.'}</p></div>}</div>
    </aside>

    <section className="chat-panel" aria-label={selected ? `Conversation with ${selected.user.name}` : 'Conversation'}>
      {!selected ? <div className="empty-state"><span><MessageCircle size={27} /></span><h2>Your messages</h2><p>Pick a conversation from the list, or start a new one.</p></div> : <>
      <header className="chat-header"><button type="button" className="icon-button chat-back" onClick={() => setChatOpen(false)} aria-label="Back to conversations"><ArrowLeft size={21} /></button><button type="button" className="chat-person" onClick={() => viewProfile(selected.user)}><Avatar user={selected.user} size="sm" /><span><strong>{selected.user.name}</strong><small>{selected.user.online ? 'Active now' : 'Away'}</small></span></button><div className="chat-header-actions"><details className="action-menu"><summary className="icon-button" aria-label="Conversation options"><MoreHorizontal size={21} /></summary><div className="action-popover chat-options"><button type="button" onClick={() => viewProfile(selected.user)}>View profile</button><button type="button" onClick={() => setSearchChat(!searchChat)}>Search in conversation</button><button type="button" className="danger-text" onClick={() => openReport({ type: 'user', target: selected.user.username, label: selected.user.username })}>Report</button></div></details></div></header>
      {searchChat && <div className="chat-search"><Search size={17} /><input autoFocus value={chatQuery} onChange={event => setChatQuery(event.target.value)} placeholder="Search this conversation" /><button type="button" onClick={() => { setSearchChat(false); setChatQuery('') }} aria-label="Close conversation search"><X size={17} /></button></div>}
      <div className="chat-body" ref={bodyRef}><div className="chat-intro"><Avatar user={selected.user} size="xl" /><h3>{selected.user.name}</h3><p>@{selected.user.username} · Luma member</p><button type="button" className="button button-secondary button-small" onClick={() => viewProfile(selected.user)}>View profile</button></div>
        {hasMore && <button type="button" className="text-button load-older" onClick={loadEarlier}>Load earlier messages</button>}
        {visibleMessages.length ? visibleMessages.map(item => <div key={item.id} className={`message-row ${item.from === 'me' ? 'mine' : ''}`}>{item.from === 'them' && <Avatar user={selected.user} size="xs" />}<div className="message-bubble" onDoubleClick={() => react(item)} title={item.deleted ? undefined : 'Double-click to react'}>{item.deleted ? <em className="message-deleted">Message deleted</em> : item.text}{item.reaction && <span className="message-reaction">{item.reaction}</span>}<small>{item.time}</small>{item.from === 'me' && !item.deleted && <button type="button" className="msg-delete" onClick={() => remove(item)} aria-label="Delete message"><Trash2 size={12} /></button>}</div></div>) : loadingMessages ? <div className="no-messages"><span className="loading-spinner" /></div> : <div className="no-messages"><Search size={22} /><p>{chatQuery ? 'No messages match your search.' : 'No messages here yet. Say hello!'}</p></div>}</div>
      <div className="chat-composer-wrap"><form className="chat-composer" onSubmit={send}><button type="button" onClick={() => setMessage(message + ' ✨')} aria-label="Add emoji"><Smile size={21} /></button><input value={message} onChange={event => setMessage(event.target.value.slice(0, 2000))} placeholder="Message…" aria-label="Message" /><button type="submit" className="send-message" disabled={!message.trim() || sending} aria-label="Send message"><Send size={19} /></button></form></div></>}
    </section>
  </div>
}
