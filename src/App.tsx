import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/autenticacao/auth-provider'
import { AppRouter } from '@/app/router'
import { TelaConfiguracao } from '@/app/tela-configuracao'
import { supabaseConfigurado } from '@/lib/supabase'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export default function App() {
  if (!supabaseConfigurado) {
    return (
      <>
        <TelaConfiguracao />
        <Toaster position="top-right" richColors />
      </>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
