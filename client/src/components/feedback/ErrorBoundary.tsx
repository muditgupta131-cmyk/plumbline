import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Unhandled UI error', error, info.componentStack);
    }
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="max-w-md space-y-4 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-bear/12 text-bear">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <h1 className="text-display-md">This screen stopped loading</h1>
          <p className="text-content-muted">
            The page hit an unexpected error. Reloading usually fixes it. If it keeps happening, your data is safe —
            nothing was saved from this screen.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={this.reset}>Try again</Button>
            <Button variant="secondary" onClick={() => window.location.assign('/')}>
              Go to home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
