import { Component, type ReactNode } from 'react'
import { Sentry } from '../lib/sentry'

interface Props {
  /** Called when the user taps "Back" — should route them to a safe screen (typically home). */
  onReset: () => void
  /** Human-readable label of the screen, shown in the fallback. */
  screenLabel?: string
  children: ReactNode
}

interface State {
  error: Error | null
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    Sentry.captureException(error, {
      tags: { area: 'route-boundary', screen: this.props.screenLabel ?? 'unknown' },
      extra: { componentStack: info.componentStack },
    })
  }

  reset = () => {
    this.setState({ error: null })
    this.props.onReset()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Something went wrong</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This screen hit an error. Your data is safe — the rest of the app is still working.
          </p>
          <pre className="text-left text-xs bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4 overflow-x-auto whitespace-pre-wrap text-red-600 dark:text-red-400">
            {this.state.error.message}
          </pre>
          <button
            onClick={this.reset}
            className="w-full h-12 bg-emerald-600 text-white font-semibold rounded-xl active:bg-emerald-700 transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    )
  }
}
