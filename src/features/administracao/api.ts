import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import type { UsuarioListado } from '@/types/dominio'

const NOME_FUNCAO = 'gerenciar-usuarios'

type Resposta = { usuarios?: UsuarioListado[]; id?: string; ok?: boolean; erro?: string }

async function chamarFuncao(corpo: Record<string, unknown>): Promise<Resposta> {
  const supabase = obterSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Entre novamente.')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${NOME_FUNCAO}`
  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify(corpo),
  })
  const dados = (await resposta.json().catch(() => ({}))) as Resposta
  if (!resposta.ok || dados.erro) {
    throw new Error(dados.erro ?? `Falha na função ${NOME_FUNCAO} (${resposta.status})`)
  }
  return dados
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async (): Promise<UsuarioListado[]> => {
      const dados = await chamarFuncao({ acao: 'listar' })
      return dados.usuarios ?? []
    },
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['usuarios'] })
}

export function useCriarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entrada: {
      email: string
      senha: string
      nome: string
      papel: string
    }): Promise<void> => {
      await chamarFuncao({ acao: 'criar', ...entrada })
    },
    onSuccess: () => {
      invalidate(qc)
      toast.success('Usuário criado')
    },
  })
}

export function useDefinirPapel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entrada: { usuario_id: string; papel: string }): Promise<void> => {
      await chamarFuncao({ acao: 'definir_papel', ...entrada })
    },
    onSuccess: () => {
      invalidate(qc)
      toast.success('Papel atualizado')
    },
  })
}

export function useDefinirAtivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entrada: { usuario_id: string; ativo: boolean }): Promise<void> => {
      await chamarFuncao({ acao: 'definir_ativo', ...entrada })
    },
    onSuccess: () => {
      invalidate(qc)
      toast.success('Situação atualizada')
    },
  })
}

export function useRedefinirSenha() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entrada: { usuario_id: string; senha: string }): Promise<void> => {
      await chamarFuncao({ acao: 'redefinir_senha', ...entrada })
    },
    onSuccess: () => {
      invalidate(qc)
      toast.success('Senha redefinida')
    },
  })
}
