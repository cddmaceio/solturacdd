import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { obterSupabase } from '@/lib/supabase'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { MarcaSoltura } from '@/app/marca'
import fundoLogin from '../../../bgsitesoltura.png'

export function TelaLogin() {
  const { sessao, carregando, recarregarPerfil } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!carregando && sessao) {
    const destino = (local.state as { de?: string } | null)?.de ?? '/escala'
    return <Navigate to={destino} replace />
  }

  async function entrar(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    try {
      const { error } = await obterSupabase().auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })
      if (error) {
        toast.error(
          error.message === 'Invalid login credentials'
            ? 'E-mail ou senha inválidos'
            : `Não foi possível entrar: ${error.message}`,
        )
        return
      }
      await recarregarPerfil()
      navegar('/escala', { replace: true })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div
        className="relative hidden overflow-hidden bg-[#0a1626] bg-cover bg-center p-10 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ backgroundImage: `url(${fundoLogin})` }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(5,14,27,.72) 0%, rgba(5,14,27,.55) 58%, rgba(5,14,27,.34) 100%), linear-gradient(0deg, rgba(5,14,27,.58) 0%, transparent 68%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div className="relative flex h-[150px] items-start">
          <img
            src="/roni-tech.svg"
            alt="Roni Tech"
            className="h-[150px] w-full max-w-[360px] object-contain object-left drop-shadow-[0_12px_28px_rgba(0,70,255,0.2)]"
          />
        </div>
        <div className="relative max-w-lg">
          <div className="mb-4 h-px w-16 bg-[#e2b53c]" />
          <p className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Escala operacional do CDD Maceió — veículos, equipes e indicadores em um único painel.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#9fb4cc]">
            PCD, ausências e dados da operação organizados com perfis e permissões para cada usuário.
          </p>
        </div>
        <p className="relative text-xs text-[#6f88a5]">Soltura · CDD Maceió</p>
      </div>

      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#050b17] px-5 py-6 sm:px-8 lg:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(#76baff 1px, transparent 1px), linear-gradient(90deg, #76baff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 78%)',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,rgba(0,89,255,0.16),transparent_58%)]" />

        <Card className="relative w-full max-w-sm border-slate-200/80 bg-white shadow-[0_20px_65px_rgba(0,0,0,0.32)]">
          <CardHeader className="space-y-1.5">
            <div className="mb-2 lg:hidden">
              <MarcaSoltura />
            </div>
            <CardTitle className="text-xl text-slate-900">Entrar</CardTitle>
            <CardDescription>Use seu e-mail e senha para acessar o painel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void entrar(e)} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <Button type="submit" className="mt-2 w-full" disabled={enviando}>
                {enviando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
