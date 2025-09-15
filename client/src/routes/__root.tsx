import { Header } from '@client/components/header/header';
import { useTheme } from '@client/components/theme-provider';
import { Toaster } from '@client/components/ui/sonner';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import '../index.css';

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const { theme } = useTheme();
  return (
    <>
      <div className='dark:bg-background flex min-h-screen flex-col bg-zinc-50'>
        <Header />
        <main className='container mx-auto h-full flex-1'>
          <Outlet />
        </main>
      </div>
      <Toaster richColors theme={theme} />
    </>
  );
}
