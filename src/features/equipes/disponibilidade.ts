import { norm } from '@/lib/texto'
import type { Colaborador } from '@/types/dominio'

export function statusDisponivel(status: string | null | undefined): boolean {
  const valor = norm(status)
  return ['', 'ATIVO', 'ATIVA', 'DISPONIVEL'].includes(valor)
}

export function colaboradorDisponivel(pessoa: Colaborador): boolean {
  return pessoa.ativo && statusDisponivel(pessoa.status)
}
