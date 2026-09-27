// Gerencia usuários do Supabase Auth e seus perfis (papéis).
// Usa a service role somente após validar que o chamador possui
// a permissão 'usuarios.gerenciar' (RLS + JWT do chamador).
//
// Ações: listar | criar | definir_papel | definir_ativo | redefinir_senha

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cabecalhos = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(erro: unknown, status = 400) {
  const mensagem = erro instanceof Error ? erro.message : String(erro)
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: { ...cabecalhos, 'Content-Type': 'application/json' },
  })
}

function clienteDoChamador(req: Request): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhos })
  if (req.method !== 'POST') return responder('Método não permitido', 405)

  try {
    const chamador = clienteDoChamador(req)
    const { data: usuario, error: erroUsuario } = await chamador.auth.getUser()
    if (erroUsuario || !usuario.user) return responder('Não autenticado', 401)

    const { data: pode, error: erroPermissao } = await chamador.rpc('possui_permissao', {
      permissao: 'usuarios.gerenciar',
    })
    if (erroPermissao) return responder(erroPermissao, 500)
    if (!pode) return responder('Permissão negada', 403)

    const admin: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { acao, ...dados } = await req.json()

    if (acao === 'listar') {
      const { data: usuarios, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
      if (error) return responder(error, 500)
      const { data: perfis, error: erroPerfis } = await admin
        .from('perfis')
        .select('id, nome, ativo, papel_id, papeis!inner (chave, nome)')
      if (erroPerfis) return responder(erroPerfis, 500)

      const porId = new Map(perfis.map((p) => [p.id, p]))
      const lista = usuarios.users.map((u) => {
        const perfil = porId.get(u.id)
        return {
          id: u.id,
          email: u.email ?? '',
          nome: perfil?.nome ?? '',
          ativo: perfil?.ativo ?? false,
          papel: (perfil?.papeis as unknown as { chave: string } | null)?.chave ?? '',
          criado_em: u.created_at,
        }
      })
      return new Response(JSON.stringify({ usuarios: lista }), {
        headers: { ...cabecalhos, 'Content-Type': 'application/json' },
      })
    }

    if (acao === 'criar') {
      const { email, senha, nome, papel } = dados as {
        email?: string
        senha?: string
        nome?: string
        papel?: string
      }
      if (!email || !senha || !papel) return responder('Informe email, senha e papel')
      if (senha.length < 8) return responder('A senha precisa de ao menos 8 caracteres')

      const { data: papelRow, error: erroPapel } = await admin
        .from('papeis')
        .select('id')
        .eq('chave', papel)
        .single()
      if (erroPapel || !papelRow) return responder('Papel inválido')

      const { data: criado, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome: nome ?? '' },
      })
      if (error) return responder(error, 400)

      const { error: erroPerfil } = await admin.from('perfis').insert({
        id: criado.user.id,
        nome: nome ?? '',
        papel_id: papelRow.id,
        criado_por: usuario.user.id,
      })
      if (erroPerfil) {
        await admin.auth.admin.deleteUser(criado.user.id)
        return responder(erroPerfil, 500)
      }
      return new Response(JSON.stringify({ id: criado.user.id }), {
        headers: { ...cabecalhos, 'Content-Type': 'application/json' },
      })
    }

    if (acao === 'definir_papel') {
      const { usuario_id, papel } = dados as { usuario_id?: string; papel?: string }
      if (!usuario_id || !papel) return responder('Informe usuário e papel')
      const { data: papelRow, error: erroPapel } = await admin
        .from('papeis')
        .select('id')
        .eq('chave', papel)
        .single()
      if (erroPapel || !papelRow) return responder('Papel inválido')
      const { error } = await admin
        .from('perfis')
        .update({ papel_id: papelRow.id })
        .eq('id', usuario_id)
      if (error) return responder(error, 500)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cabecalhos, 'Content-Type': 'application/json' },
      })
    }

    if (acao === 'definir_ativo') {
      const { usuario_id, ativo } = dados as { usuario_id?: string; ativo?: boolean }
      if (!usuario_id || typeof ativo !== 'boolean') return responder('Informe usuário e situação')
      const { error } = await admin.from('perfis').update({ ativo }).eq('id', usuario_id)
      if (error) return responder(error, 500)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cabecalhos, 'Content-Type': 'application/json' },
      })
    }

    if (acao === 'redefinir_senha') {
      const { usuario_id, senha } = dados as { usuario_id?: string; senha?: string }
      if (!usuario_id || !senha) return responder('Informe usuário e nova senha')
      if (senha.length < 8) return responder('A senha precisa de ao menos 8 caracteres')
      const { error } = await admin.auth.admin.updateUserById(usuario_id, { password: senha })
      if (error) return responder(error, 400)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cabecalhos, 'Content-Type': 'application/json' },
      })
    }

    return responder(`Ação desconhecida: ${acao}`)
  } catch (e) {
    return responder(e, 500)
  }
})
