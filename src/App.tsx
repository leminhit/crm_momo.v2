import { lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/ui/skeleton';
import { CrmProvider, useCrm } from './contexts/CrmContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

const LoginView = lazy(() =>
  import('./components/LoginView').then((m) => ({ default: m.LoginView }))
);

function AuthSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-10 w-40 mx-auto" />
        <Skeleton className="h-4 w-56 mx-auto" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}

function RootRouter() {
  const { isAuthenticated, loadingAuth } = useCrm();
  const { theme } = useTheme();

  if (loadingAuth) {
    return <AuthSkeleton />;
  }

  return (
    <>
      {isAuthenticated ? (
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      ) : (
        <Suspense fallback={<AuthSkeleton />}>
          <LoginView />
        </Suspense>
      )}
      <Toaster
        position="top-right"
        richColors
        theme={theme}
        toastOptions={{
          duration: 3000,
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <CrmProvider>
          <RootRouter />
        </CrmProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
