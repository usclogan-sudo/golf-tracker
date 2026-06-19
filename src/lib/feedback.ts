import { supabase } from './supabase'
import { APP_VERSION, APP_PLATFORM, Sentry } from './sentry'

export type FeedbackCategory = 'bug' | 'idea' | 'praise' | 'other'

export interface SubmitFeedbackInput {
  userId: string | null
  userEmail?: string
  category: FeedbackCategory
  message: string
  route?: string
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.message.trim()) {
    return { ok: false, error: 'Please describe what you saw.' }
  }

  const context: Record<string, unknown> = {
    submitted_at: new Date().toISOString(),
  }

  try {
    const { error } = await supabase.from('feedback_reports').insert({
      user_id: input.userId,
      user_email: input.userEmail?.trim() || null,
      category: input.category,
      message: input.message.trim(),
      app_version: APP_VERSION,
      app_platform: APP_PLATFORM,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      route: input.route ?? (typeof window !== 'undefined' ? window.location.hash || window.location.pathname : null),
      context,
    })

    if (error) {
      Sentry.captureMessage('Feedback submission failed', {
        level: 'warning',
        tags: { area: 'feedback' },
        extra: { error: error.message, category: input.category },
      })
      return { ok: false, error: "Couldn't send right now. Please try again in a moment." }
    }

    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'feedback' } })
    return { ok: false, error: "Couldn't send right now. Please try again in a moment." }
  }
}
