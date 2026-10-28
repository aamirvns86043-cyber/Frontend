export type Route = 'home' | 'explore' | 'reels' | 'messages' | 'notifications' | 'profile' | 'settings' | 'saved' | 'activity' | 'auth'

export type MediaType = 'image' | 'video' | 'carousel'

export interface User {
  id: string
  name: string
  username: string
  avatar: string
  bio?: string
  verified?: boolean
  online?: boolean
}

export interface Me extends User {
  email: string | null
  phone: string | null
  contactVerified: boolean
  settings: Record<string, boolean | number | string>
  createdAt: string
}

export interface Profile extends User {
  followers: number
  following: number
  posts: number
  isFollowing: boolean
  followsYou: boolean
  isMe: boolean
}

export interface Comment {
  id: string
  user: User
  text: string
  time: string
  createdAt: string
}

export interface Post {
  id: string
  user: User
  type: MediaType
  image: string
  video?: string
  poster?: string
  images?: string[]
  audio?: string
  location: string
  caption: string
  likes: number
  commentsCount: number
  comments: Comment[]
  time: string
  createdAt: string
  liked: boolean
  saved: boolean
}

/** Small tile used in Explore / Saved / Activity grids. */
export interface GridItem {
  id: string
  type: MediaType
  image: string
  video?: string
  likes?: number
  commentsCount?: number
}

export interface Story {
  id: string
  user: User
  image: string
  video?: string
  kind: 'image' | 'video'
  time: string
  createdAt: string
  expiresAt: string
  closeFriends: boolean
  seen: boolean
}

export interface Reel {
  id: string
  user: User
  video: string
  poster: string
  caption: string
  audio: string
  likes: number
  comments: number
  liked: boolean
  saved: boolean
  time: string
}

export interface Conversation {
  id: string
  user: User
  lastMessage: string
  lastSender: 'me' | 'them' | null
  time: string
  lastMessageAt: string
  unread: number
}

export interface Message {
  id: string
  from: 'me' | 'them'
  text: string
  deleted: boolean
  reaction?: string
  time: string
  createdAt: string
}

export interface NotificationItem {
  id: string
  type: 'like' | 'comment' | 'follow'
  user: User
  post: GridItem | null
  text: string
  read: boolean
  time: string
  createdAt: string
}

export interface ActivityItem {
  id: string
  type: 'like' | 'comment'
  post: GridItem
  text: string
  time: string
  createdAt: string
}

export interface ReportTarget {
  type: 'post' | 'user' | 'comment' | 'story' | 'message'
  target: string
  label: string
}
