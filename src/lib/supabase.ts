import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHAVE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(URL_SUPABASE && CHAVE_ANON)

let cliente: SupabaseClient | null = null

export function obterSupabase(): SupabaseClient {
  if (!supabaseConfigurado || !URL_SUPABASE || !CHAVE_ANON) {
    throw new Error(
      'Supabase não configurado. Copie .env.example para .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
    )
  }
  if (!cliente) cliente = createClient(URL_SUPABASE, CHAVE_ANON)
  return cliente
}
