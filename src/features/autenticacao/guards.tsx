import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/features/autenticacao/auth-provider'
import type { PermissaoChave } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function Esperando() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
    </div>
  )
}

export function ExigirLogin({ children }: { children: ReactNode }) {
  const { sessao, carregando, semPerfil } = useAuth()
  const local = useLocation()

  if (carregando) return <Esperando />
  if (!sessao) return <Navigate to="/login" replace state={{ de: local.pathname }} />
  if (semPerfil) return <TelaSemPerfil />
  return <>{children}</>
}

export function Guard({
  permissao,
  children,
}: {
  permissao: PermissaoChave
  children: ReactNode
}) {
  const { pode } = useAuth()
  if (!pode(permissao)) return <TelaSemPermissao />
  return <>{children}</>
}

function TelaSemPerfil() {
  const { sessao, sair } = useAuth()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Perfil não cadastrado</CardTitle>
          <CardDescription>
            A conta <b>{sessao?.user.email}</b> existe, mas ainda não possui perfil no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <button
            onClick={() => void sair()}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Entrar com outra conta
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

function TelaSemPermissao() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>
            Seu papel não tem permissão para acessar esta área. Se você precisa dela, fale com um
            administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
