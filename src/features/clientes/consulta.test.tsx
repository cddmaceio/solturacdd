import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { usePesquisarClientes } from './api'
import { TelaClientes } from './tela-clientes'
import { DialogoClientesMapa } from './dialogo-clientes-mapa'
import type { Cliente } from './lib'

const cliente: Cliente = {
  codigo: '42234', nome: 'Mercado Central', codigo_roteirizador: '15742234',
  endereco: 'Rua A, 9', cidade: 'Maceió', estado: 'AL', setor: '121 - Barro duro', bairro: 'Barro Duro',
  latitude: -9.616584, longitude: -35.719296, ultima_compra: '2026-10-16',
  penultima_compra: '2026-10-02', antepenultima_compra: null,
  na_base_clientes: true, na_base_roteirizador: true,
}
vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  useClientesPorCodigos: () => ({ data: [cliente], isLoading: false, error: null }),
  usePesquisarClientes: vi.fn(() => ({ data: { clientes: [cliente], temMais: true }, isLoading: false, error: null })),
  useResumoBasesClientes: () => ({ data: undefined, isLoading: true, error: null }),
  useImportarBaseClientes: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/autenticacao/auth-provider', () => ({ useAuth: () => ({ pode: (permissao: string) => permissao === 'bases.visualizar' }) }))

describe('consulta de clientes', () => {
  it('abre a consulta imediatamente mesmo enquanto os totais carregam', () => {
    render(<MemoryRouter><TelaClientes /></MemoryRouter>)
    expect(screen.getByRole('textbox', { name: 'Buscar cliente por código ou nome' })).toBeEnabled()
    expect(screen.getByText('Informe um código ou nome para consultar.')).toBeInTheDocument()
    expect(screen.queryByText('Buscando clientes…')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mercado Central' })).not.toBeInTheDocument()
  })
  it('aguarda uma pausa na digitação e permite consultar a próxima página', async () => {
    render(<MemoryRouter initialEntries={['/clientes?codigo=mercado']}><TelaClientes /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(usePesquisarClientes).toHaveBeenLastCalledWith('mercado', 1, true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar cliente por código ou nome' }), { target: { value: 'central' } })
    expect(screen.queryByRole('heading', { name: 'Mercado Central' })).not.toBeInTheDocument()
    expect(screen.getByText('Buscando clientes…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Mercado Central' })).toBeInTheDocument()
    expect(usePesquisarClientes).toHaveBeenLastCalledWith('central', 0, true)
  })
  it('consulta por código prefixado e apresenta mapa e datas corretas', () => {
    render(<MemoryRouter initialEntries={['/clientes?codigo=15742234']}><TelaClientes /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Mercado Central' })).toBeInTheDocument()
    expect(screen.getByText('16/10/2026')).toBeInTheDocument()
    expect(screen.getByText('02/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Não informada na base')).toBeInTheDocument()
    expect(screen.getByTitle('Localização de Mercado Central')).toHaveAttribute('src', expect.stringContaining('marker=-9.616584,-35.719296'))
    expect(screen.queryByRole('button', { name: 'Importar clientes' })).not.toBeInTheDocument()
  })
  it('mostra nomes e códigos não encontrados no drilldown do PCD e permite filtrar', () => {
    render(<MemoryRouter><DialogoClientesMapa mapa={{ mapa: '100', clientes: '0042234/0099999/42234' }} onClose={vi.fn()} podeConsultar /></MemoryRouter>)
    expect(screen.getByText('2 cliente(s) · Nomes cruzados com as bases importadas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mercado Central' })).toHaveAttribute('href', '/clientes?codigo=42234')
    expect(screen.getByRole('columnheader', { name: 'Setor' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Bairro' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Cidade' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '121 - Barro duro' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Barro Duro' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Maceió' })).toBeInTheDocument()
    expect(screen.getByText('Não encontrado nas bases importadas')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Filtrar clientes do mapa' }), { target: { value: 'central' } })
    expect(screen.queryByText('Não encontrado nas bases importadas')).not.toBeInTheDocument()
    expect(screen.getByText('Mercado Central')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Filtrar clientes do mapa' }), { target: { value: 'maceio' } })
    expect(screen.getByText('Mercado Central')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Filtrar clientes do mapa' }), { target: { value: 'Barro Duro' } })
    expect(screen.getByText('Mercado Central')).toBeInTheDocument()
  })
})
