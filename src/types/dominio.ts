import type { PapelChave } from '@/lib/rbac'

export type TipoColaborador = 'motorista' | 'ajudante'
export type PapelEquipe = TipoColaborador
export type PapelSlot = 'motorista' | 'ajudante' | 'ajudante2' | 'chapa'

export type TipoAusencia =
  | 'Folga'
  | 'Falta'
  | 'Férias'
  | 'Atestado'
  | 'INSS'
  | 'Banco de horas'
  | 'Treinamento'
  | 'Outros'

export const TIPOS_AUSENCIA: TipoAusencia[] = [
  'Folga',
  'Falta',
  'Férias',
  'Atestado',
  'INSS',
  'Banco de horas',
  'Treinamento',
  'Outros',
]

export type Papel = {
  id: string
  chave: PapelChave
  nome: string
  descricao: string | null
}

export type Perfil = {
  id: string
  nome: string
  papel_id: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export type Colaborador = {
  id: string
  codigo: string
  nome: string
  tipo: TipoColaborador
  sala: string | null
  status: string
  ativo: boolean
}

export type Equipe = {
  id: string
  motorista_id: string | null
  ajudante_id: string | null
}

export type EquipeComPessoas = Equipe & {
  motorista: Colaborador | null
  ajudante: Colaborador | null
}

export type Veiculo = {
  id: string
  placa: string
  tipo_veiculo: string
  frota: string | null
  disponibilidade: string | null
  territorio: string | null
  motorista_fixo_codigo: string | null
  motorista_fixo_nome: string | null
  ativo: boolean
}

export type PcdMapa = {
  id: string
  data_entrega: string
  mapa: string
  roadshow: string | null
  transportadora: string | null
  as_rota: string | null
  armazem: string | null
  tipo_veiculo: string | null
  placa: string | null
  veiculo_substituto: string | null
  motorista_codigo: string | null
  carga: string | null
  mpd: string | null
  hora_mpd: string | null
  classificacao: string | null
  km_previsto: number | null
  tempo_previsto: string | null
  entregas: number | null
  total_caixas: number | null
  ocupacao_caixas_pct: number | null
  total_peso: number | null
  ocupacao_peso_pct: number | null
  eficiencia_pct: number | null
  carga_atual: string | null
  cidades: string | null
  regiao: string | null
  clientes: string | null
}

export type EscalaLinha = {
  id: string
  data_operacao: string
  veiculo_placa: string
  motorista_codigo: string | null
  motorista_nome: string | null
  ajudante_codigo: string | null
  ajudante_nome: string | null
  ajudante2_codigo: string | null
  ajudante2_nome: string | null
  chapa_codigo: string | null
  chapa_nome: string | null
  sala: string | null
  observacao: string | null
  /** Slot escolhido/limpo pelo usuário; não é reposto pela equipe fixa. */
  motorista_manual?: boolean
  ajudante_manual?: boolean
  ajudante2_manual?: boolean
  chapa_manual?: boolean
}

export type Ausencia = {
  id: string
  data: string
  papel: 'motorista' | 'ajudante'
  codigo: string
  nome: string
  colaborador_id: string | null
  tipo: TipoAusencia
  justificativa: string | null
  status_base: string | null
}

export type UsuarioListado = {
  id: string
  email: string
  nome: string
  ativo: boolean
  papel: PapelChave | ''
  criado_em: string
}
