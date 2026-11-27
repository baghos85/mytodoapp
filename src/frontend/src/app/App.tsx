import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { UpdatePrompt } from '../shared/pwa/UpdatePrompt';
import { AppProviders } from './providers';
import { createQueryClient } from './queryClient';
import { appRoutes } from './router';

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter(appRoutes));

  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AppProviders>
  );
}
