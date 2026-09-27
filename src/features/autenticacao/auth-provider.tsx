import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { obterSupabase } from '@/lib/supabase'
import type { PermissaoChave, PapelChave } from '@/lib/rbac'
import type { Perfil } from '@/types/dominio'

type EstadoAuth = {
  sessao: Session | null
  perfil: Perfil | null
  papel: PapelChave | null
  permissoes: ReadonlySet<PermissaoChave>
}

type ContextoAuth = EstadoAuth & {
  carregando: boolean
  semPerfil: boolean
  pode: (permissao: PermissaoChave) => boolean
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

const Contexto = createContext<ContextoAuth | null>(null)

async function carregarEstado(userId: string): Promise<{
  perfil: Perfil | null
  papel: PapelChave | null
  permissoes: ReadonlySet<PermissaoChave>
}> {
  const db = obterSupabase()
  const { data: perfil } = await db
    .from('perfis')
    .select('id, nome, papel_id, ativo, criado_em, atualizado_em, papeis!inner (chave)')
    .eq('id', userId)
    .single()

  if (!perfil) return { perfil: null, papel: null, permissoes: new Set() }

  const papel = (perfil.papeis as unknown as { chave: PapelChave } | null)?.chave ?? null
  const { data: vinculos } = await db
    .from('papeis_permissoes')
    .select('permissoes!inner (chave)')
    .eq('papel_id', perfil.papel_id)

  const permissoes = new Set<PermissaoChave>()
  for (const v of vinculos ?? []) {
    const chave = (v.permissoes as unknown as { chave: PermissaoChave } | null)?.chave
    if (chave) permissoes.add(chave)
  }
  if (perfil.ativo === false) permissoes.clear()

  return { perfil: perfil as Perfil, papel, permissoes }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({
    sessao: null,
    perfil: null,
    papel: null,
    permissoes: new Set(),
  })
  const [carregando, setCarregando] = useState(true)

  const recarregarPerfil = useCallback(async () => {
    const db = obterSupabase()
    const { data } = await db.auth.getSession()
    const sessao = data.session
    if (!sessao) {
      setEstado({ sessao: null, perfil: null, papel: null, permissoes: new Set() })
      return
    }
    const carregado = await carregarEstado(sessao.user.id)
    setEstado({ sessao, ...carregado })
  }, [])

  useEffect(() => {
    const db = obterSupabase()
    let ativo = true

    db.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      if (data.session) {
        const carregado = await carregarEstado(data.session.user.id)
        if (ativo) setEstado({ sessao: data.session, ...carregado })
      }
      if (ativo) setCarregando(false)
    })

    const { data: assinatura } = db.auth.onAuthStateChange(async (_evento, sessao) => {
      if (!sessao) {
        setEstado({ sessao: null, perfil: null, papel: null, permissoes: new Set() })
        return
      }
      const carregado = await carregarEstado(sessao.user.id)
      setEstado({ sessao, ...carregado })
    })

    return () => {
      ativo = false
      assinatura.subscription.unsubscribe()
    }
  }, [])

  const sair = useCallback(async () => {
    await obterSupabase().auth.signOut()
  }, [])

  const valor = useMemo<ContextoAuth>(() => {
    const semPerfil = Boolean(estado.sessao) && !estado.perfil
    return {
      ...estado,
      carregando,
      semPerfil,
      pode: (permissao) => estado.permissoes.has(permissao),
      recarregarPerfil,
      sair,
    }
  }, [estado, carregando, recarregarPerfil, sair])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth(): ContextoAuth {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
