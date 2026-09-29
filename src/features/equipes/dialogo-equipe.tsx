import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useSalvarEquipe,
  type FormularioEquipe,
} from '@/features/equipes/api'
import type { EquipeComPessoas } from '@/types/dominio'

const STATUS_OPCOES = [
  'Disponivel',
  'Férias',
  'INSS',
  'Atestado',
  'Treinamento',
  'Afastado',
]

const FORM_VAZIO: FormularioEquipe = {
  motorista_codigo: '',
  motorista_nome: '',
  ajudante_codigo: '',
  ajudante_nome: '',
  sala: '',
  status: 'Disponivel',
}

export function DialogoEquipe({
  aberto,
  equipe,
  salas,
  onFechar,
}: {
  aberto: boolean
  equipe: EquipeComPessoas | null
  salas: string[]
  onFechar: () => void
}) {
  const [form, setForm] = useState<FormularioEquipe>(FORM_VAZIO)
  const [erro, setErro] = useState('')
  const salvar = useSalvarEquipe()

  useEffect(() => {
    if (aberto) {
      setErro('')
      if (equipe) {
        setForm({
          id: equipe.id,
          motorista_codigo: equipe.motorista?.codigo ?? '',
          motorista_nome: equipe.motorista?.nome ?? '',
          ajudante_codigo: equipe.ajudante?.codigo ?? '',
          ajudante_nome: equipe.ajudante?.nome ?? '',
          sala: equipe.motorista?.sala ?? equipe.ajudante?.sala ?? '',
          status: equipe.motorista?.status || equipe.ajudante?.status || 'Disponivel',
        })
      } else {
        setForm(FORM_VAZIO)
      }
    }
  }, [aberto, equipe])

  function alterar(campo: keyof FormularioEquipe, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function confirmar() {
    setErro('')
    salvar.mutate(form, {
      onSuccess: onFechar,
      onError: (e) => setErro(e.message),
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {equipe ? 'Editar equipe' : 'Adicionar equipe'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="eq-cod-m">Cód. Motorista</Label>
            <Input
              id="eq-cod-m"
              value={form.motorista_codigo}
              onChange={(e) => alterar('motorista_codigo', e.target.value)}
              placeholder="Código do motorista"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-nome-m">Motorista</Label>
            <Input
              id="eq-nome-m"
              value={form.motorista_nome}
              onChange={(e) => alterar('motorista_nome', e.target.value)}
              placeholder="Nome do motorista"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-cod-a">Cód. Ajudante</Label>
            <Input
              id="eq-cod-a"
              value={form.ajudante_codigo}
              onChange={(e) => alterar('ajudante_codigo', e.target.value)}
              placeholder="Código do ajudante"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-nome-a">Ajudante</Label>
            <Input
              id="eq-nome-a"
              value={form.ajudante_nome}
              onChange={(e) => alterar('ajudante_nome', e.target.value)}
              placeholder="Nome do ajudante"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-sala">Sala</Label>
            <Input
              id="eq-sala"
              value={form.sala}
              onChange={(e) => alterar('sala', e.target.value.toUpperCase())}
              placeholder="ELITE, FORÇA, VANS…"
              list="eq-lista-salas"
            />
            <datalist id="eq-lista-salas">
              {salas.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-status">Status base</Label>
            <Input
              id="eq-status"
              value={form.status}
              onChange={(e) => alterar('status', e.target.value)}
              placeholder="Disponivel"
              list="eq-lista-status"
            />
            <datalist id="eq-lista-status">
              {STATUS_OPCOES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Cadastre somente motorista, somente ajudante ou a dupla completa — código e nome sempre
          juntos. Códigos duplicados são bloqueados. As escalas salvas preservam os nomes e códigos
          registrados. Ajustes de alocação são feitos na própria escala.
        </p>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
            {equipe ? 'Salvar alterações' : 'Adicionar equipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
