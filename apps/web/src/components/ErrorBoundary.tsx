import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  override render() {
    if (this.state.error) {
      return <ErrorState onRetry={this.reset} />
    }

    return this.props.children
  }
}
