import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>App Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#666', marginTop: 8 }}>{this.state.error.stack}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/golf-tracker/sw.js').catch(() => {})
  })
}
