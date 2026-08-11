import { RouterProvider } from 'react-router/dom'

import { ToastViewport } from '@/components/ui'
import { ImportProvider } from '@/features/import/ImportProvider'
import { ThemeProvider } from '@/theme'

import { ErrorBoundary } from './ErrorBoundary'
import { router } from './routes'

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ImportProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </ImportProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
