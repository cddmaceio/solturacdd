import type { Colaborador, EscalaLinha, PcdMapa } from '@/types/dominio'
import { montarEscala, paraLinhasPersistencia, type EntradaMontagem } from './montagem'
export type { Colaborador }
export type Entrada = EntradaMontagem

export function mapa(numero = '574742', data = '2026-09-26'): PcdMapa {
  return {
    id: numero, mapa: numero, data_entrega: data, placa: 'UHJ6F39', motorista_codigo: '296',
    roadshow: null, transportadora: '10', as_rota: null, armazem: null, tipo_veiculo: 'TRUCK',
    veiculo_substituto: null, carga: 'Fixa', mpd: 'EMITIDO', hora_mpd: null, classificacao: 'Padrao',
    km_previsto: 35.56, tempo_previsto: '09:13:00', entregas: 10, total_caixas: 241.38,
    ocupacao_caixas_pct: 57.47, total_peso: 6684, ocupacao_peso_pct: 53.13, eficiencia_pct: null,
    carga_atual: null, cidades: null, regiao: null, clientes: null,
  }
}
export function entrada(): EntradaMontagem {
  const pessoas: Colaborador[] = [
    { id: 'm10', codigo: '10', nome: 'FIXO', tipo: 'motorista', sala: 'FORÇA', status: 'Disponivel', ativo: true },
    { id: 'a20', codigo: '20', nome: 'AJUDANTE FIXO', tipo: 'ajudante', sala: 'FORÇA', status: 'Disponivel', ativo: true },
    { id: 'm296', codigo: '296', nome: 'NELSON', tipo: 'motorista', sala: 'FORÇA', status: 'Disponivel', ativo: true },
  ]
  return {
    dataIso: '2026-09-28', hojeIso: '2026-09-28',
    veiculos: [{ id: 'v', placa: 'UHJ6F39', tipo_veiculo: 'TRUCK', frota: 'F1', disponibilidade: 'DISPONIVEL',
      territorio: '', motorista_fixo_codigo: '10', motorista_fixo_nome: 'FIXO', ativo: true }],
    mapas: [mapa()], pessoas, equipes: [{ id: 'e', motorista_id: 'm10', ajudante_id: 'a20', motorista: pessoas[0], ajudante: pessoas[1] }],
    salvas: [],
  }
}
export function salvar(e: EntradaMontagem): EscalaLinha[] {
  return paraLinhasPersistencia(montarEscala(e), e.dataIso, e.pessoas).map((s, i) => ({ ...s, id: `s${i}` }))
}
