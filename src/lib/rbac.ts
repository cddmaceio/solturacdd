export const PAPEIS = ['admin', 'supervisor', 'operador'] as const
export type PapelChave = (typeof PAPEIS)[number]

export const PERMISSOES = [
  'escala.visualizar',
  'escala.editar',
  'bases.visualizar',
  'bases.editar',
  'pcd.visualizar',
  'pcd.importar',
  'ausencias.visualizar',
  'ausencias.registrar',
  'indicadores.visualizar',
  'exportacoes.gerar',
  'usuarios.gerenciar',
] as const
export type PermissaoChave = (typeof PERMISSOES)[number]

export const ROTULO_PAPEL: Record<PapelChave, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
}

export const ROTULO_PERMISSAO: Record<PermissaoChave, string> = {
  'escala.visualizar': 'Ver a escala do dia',
  'escala.editar': 'Montar e editar a escala',
  'bases.visualizar': 'Ver as bases',
  'bases.editar': 'Editar veículos e equipes',
  'pcd.visualizar': 'Ver o PCD',
  'pcd.importar': 'Importar o arquivo do PCD',
  'ausencias.visualizar': 'Ver ausências e folgas',
  'ausencias.registrar': 'Registrar ausências e folgas',
  'indicadores.visualizar': 'Ver indicadores',
  'exportacoes.gerar': 'Gerar exportações e impressões',
  'usuarios.gerenciar': 'Gerenciar usuários e papéis',
}

export const PERMISSOES_POR_PAPEL: Record<PapelChave, PermissaoChave[]> = {
  admin: [...PERMISSOES],
  supervisor: PERMISSOES.filter((p) => p !== 'usuarios.gerenciar'),
  operador: [
    'escala.visualizar',
    'bases.visualizar',
    'pcd.visualizar',
    'ausencias.visualizar',
    'indicadores.visualizar',
    'exportacoes.gerar',
  ],
}
