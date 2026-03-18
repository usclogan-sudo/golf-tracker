import { useEffect, useState, useCallback } from 'react'
import { supabase, rowToNotification } from '../lib/supabase'
import type { AppNotification } from '../types'

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [latestToast, setLatestToast] = useState<AppNotification | null>(null)

  // Fetch existing unread notifications
  useEffect(() => {
    if (!userId) return
    supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setNotifications(data.map(rowToNotification))
      })
  }, [userId])

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = rowToNotification(payload.new)
        setNotifications(prev => [n, ...prev])
        setLatestToast(n)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const unreadCount = notifications.filter(n => !n.read).length

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
  }, [notifications])

  const dismissToast = useCallback(() => setLatestToast(null), [])

  return { notifications, unreadCount, latestToast, markRead, markAllRead, dismissToast }
}
