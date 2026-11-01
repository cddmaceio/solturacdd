import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useClientesPorCodigos, usePesquisarClientes, useResumoBasesClientes } from './api'
import type { ReactNode } from 'react'

const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ obterSupabase: () => db }))
const select = vi.fn()
const filtro = vi.fn()

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  db.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [], error: null }) })
  filtro.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [], error: null }) })
  select.mockReturnValue({ in: filtro, abortSignal: () => Promise.resolve({ count: 14907, error: null }) })
  db.from.mockReturnValue({ select })
})

describe('carregamento seletivo dos clientes', () => {
  it('não baixa cadastros ao abrir a consulta vazia ou digitar um nome curto', () => {
    renderHook(() => usePesquisarClientes('', 0), { wrapper: wrapper() })
    renderHook(() => usePesquisarClientes('me', 0), { wrapper: wrapper() })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
  })
  it('busca uma página no servidor e usa somente 50 cadastros mais o indicador de próxima', async () => {
    db.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: Array.from({ length: 51 }, (_, i) => ({ codigo: String(i) })), error: null }) })
    const { result } = renderHook(() => usePesquisarClientes('mercado', 2), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(db.rpc).toHaveBeenCalledWith('buscar_clientes', { termo: 'mercado', pagina: 2 })
    expect(result.current.data?.clientes).toHaveLength(50)
    expect(result.current.data?.temMais).toBe(true)
    expect(db.from).not.toHaveBeenCalled()
  })
  it('obtém somente contagens, sem transferir os cadastros para os totais', async () => {
    const { result } = renderHook(() => useResumoBasesClientes(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(select).toHaveBeenCalledWith('codigo', { count: 'exact', head: true })
    expect(result.current.data).toEqual({ clientes: 14907, roteirizador: 14907 })
  })
  it('carrega somente os códigos do mapa e as alternativas com prefixo normalizado', async () => {
    const { result } = renderHook(() => useClientesPorCodigos(['0042234', '15748184', '42234']), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(filtro).toHaveBeenCalledOnce()
    expect(filtro).toHaveBeenCalledWith('codigo', ['15748184', '42234', '48184'])
  })
  it('divide uma lista grande em lotes limitados e não busca com lista vazia', async () => {
    renderHook(() => useClientesPorCodigos([]), { wrapper: wrapper() })
    expect(db.from).not.toHaveBeenCalled()
    const { result } = renderHook(() => useClientesPorCodigos(Array.from({ length: 250 }, (_, i) => String(i + 1000))), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(filtro).toHaveBeenCalledTimes(3)
    for (const [, codigos] of filtro.mock.calls) expect(codigos.length).toBeLessThanOrEqual(100)
  })
})
