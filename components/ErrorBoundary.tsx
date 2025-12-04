import React, { ErrorInfo, ReactNode } from 'react';
import { WarningIcon } from './icons/WarningIcon.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  // Fix: Reverted to using a constructor for state initialization. The class property syntax, while modern, was causing type inference issues with `this.props` in this environment.
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.toString() || "An unknown error occurred.";
      const isApiKeyError = errorMessage.includes("API key not found") || errorMessage.includes("API key is missing");

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6">
          <div className="text-center w-full max-w-2xl bg-surface border border-surface-border rounded-2xl p-8 shadow-lg">
            <div className="flex justify-center mb-6">
              <WarningIcon className="w-16 h-16 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold mb-4 text-red-500">
              Application Error
            </h1>

            {isApiKeyError ? (
              <>
                <p className="text-lg text-foreground/80 mb-6">
                  The application cannot connect to the AI service because the <strong>API Key</strong> is missing or not configured correctly in your project's environment variables.
                </p>
                <div className="text-left bg-background p-4 rounded-lg border border-surface-border my-6">
                  <h4 className="font-bold mb-3 text-foreground">How to Fix This in Vercel:</h4>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-foreground/80">
                    <li>Go to your Vercel Project and click the <strong>Settings</strong> tab.</li>
                    <li>Select <strong>Environment Variables</strong> from the side menu.</li>
                    <li>Create a variable with the name <code className="bg-surface p-1 rounded-md text-red-500 font-mono">API_KEY</code>. (It must be exactly this, case-sensitive).</li>
                    <li>Paste your Google AI Studio API key into the value field.</li>
                    <li>Ensure the key is applied to all environments (Production, Preview, Development).</li>
                    <li>After saving, you <strong>must redeploy</strong>. Go to the "Deployments" tab, click the menu (...) on the latest deployment, and choose "Redeploy".</li>
                  </ol>
                </div>
                 <a
                    href="https://ai.google.dev/gemini-api/docs/api-key"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brand-cta text-white font-bold py-3 px-8 rounded-xl shadow-lg transform hover:scale-105 inline-block"
                >
                    Get Your API Key
                </a>
              </>
            ) : (
              <>
                <p className="text-lg text-foreground/80 mb-6">
                  Sorry, something went wrong and the application could not start. Please try refreshing the page.
                </p>
                <details className="w-full text-left">
                    <summary className="cursor-pointer text-sm text-foreground/60 hover:text-foreground">
                        Click to see error details
                    </summary>
                    <pre className="mt-2 p-4 bg-background rounded-lg text-xs text-red-400 overflow-auto">
                        <code>{errorMessage}</code>
                    </pre>
                </details>
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
