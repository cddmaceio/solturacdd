import { DndContext } from '@dnd-kit/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LinhaVeiculo } from './tela-escala'
import { montarEscala } from './montagem'
import { entrada, salvar } from './fixtures-arquivo'
import { AreaImpressao } from './impressao'

describe('linha da escala', () => {
  it('imprime o mesmo pernoite preservado após fechamento no PCD', () => {
    const inicial = entrada()
    const veiculos = montarEscala({ ...inicial, salvas: salvar(inicial),
      mapas: [{ ...inicial.mapas[0], mpd: 'PC financeira' }] })
    render(<AreaImpressao modo="geral" veiculos={veiculos} dataIso={inicial.dataIso} nomeDe={() => 'NELSON'} />)
    expect(screen.getByText('UHJ6F39')).toBeInTheDocument()
    expect(screen.getByText(/574742.*EMITIDO/)).toBeInTheDocument()
    expect(screen.getByText(/296.*NELSON/)).toBeInTheDocument()
    expect(document.querySelector('.print-table tr[data-destaque="pernoite"]')).not.toBeNull()
  })
  it('recolhe apenas o ajudante vazio, mantendo Chapa/PX visível e sem gravar mudanças', () => {
    const [v] = montarEscala(entrada())
    v.chapa_nome = 'PEDRO PX'
    const abrir = vi.fn()
    const { container, rerender } = render(<DndContext><LinhaVeiculo v={v} dataIso="2026-09-28" salas={['FORÇA']}
      nomeDe={() => 'NELSON'} statusDe={() => ''} podeEditar
      onAbrirModal={abrir} onGrupo={vi.fn()} onObservacao={vi.fn()} onRestaurar={vi.fn()} /></DndContext>)
    expect(container.querySelector('[data-destaque="pernoite"]')).toHaveClass('bg-yellow-100')
    expect(screen.getByText('Ajudante')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Recolher campo do ajudante/ }))
    expect(screen.queryByText('Ajudante')).not.toBeInTheDocument()
    expect(screen.getByText('PEDRO PX')).toBeVisible()
    expect(abrir).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Mostrar campo do ajudante/ }))
    expect(screen.getByText('Ajudante')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Recolher campo do ajudante/ }))
    rerender(<DndContext><LinhaVeiculo v={{ ...v, ajudante_codigo: '20' }} dataIso="2026-09-28" salas={['FORÇA']}
      nomeDe={() => 'PESSOA'} statusDe={() => ''} podeEditar
      onAbrirModal={abrir} onGrupo={vi.fn()} onObservacao={vi.fn()} onRestaurar={vi.fn()} /></DndContext>)
    expect(screen.getByText('Ajudante')).toBeVisible()
    expect(screen.queryByRole('button', { name: /campo do ajudante/ })).not.toBeInTheDocument()
  })
})
