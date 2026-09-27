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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useColaboradores } from '@/features/equipes/api'
import { SITUACOES_DISPONIBILIDADE, TIPOS_VEICULO } from '@/features/veiculos/lib'
import type { NovoVeiculo } from '@/features/veiculos/api'
import type { Veiculo } from '@/types/dominio'
import { code } from '@/lib/texto'

type Formulario = {
  placa: string
  tipo_veiculo: string
  frota: string
  disponibilidade: string
  motorista_fixo_codigo: string
  motorista_fixo_nome: string
}

const FORM_VAZIO: Formulario = {
  placa: '',
  tipo_veiculo: '',
  frota: '',
  disponibilidade: '',
  motorista_fixo_codigo: '',
  motorista_fixo_nome: '',
}

function paraFormulario(veiculo: Veiculo | null): Formulario {
  if (!veiculo) return FORM_VAZIO
  return {
    placa: veiculo.placa,
    tipo_veiculo: veiculo.tipo_veiculo,
    frota: veiculo.frota ?? '',
    disponibilidade: veiculo.disponibilidade ?? '',
    motorista_fixo_codigo: veiculo.motorista_fixo_codigo ?? '',
    motorista_fixo_nome: veiculo.motorista_fixo_nome ?? '',
  }
}

export function DialogoVeiculo({
  aberto,
  veiculo,
  salvasExistentes,
  onFechar,
  onSalvar,
}: {
  aberto: boolean
  veiculo: Veiculo | null
  salvasExistentes: Veiculo[]
  onFechar: () => void
  onSalvar: (dados: { id?: string; veiculo: NovoVeiculo }) => void
}) {
  const [form, setForm] = useState<Formulario>(FORM_VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const { data: colaboradores } = useColaboradores()

  useEffect(() => {
    if (aberto) {
      setForm(paraFormulario(veiculo))
      setErro('')
      setSalvando(false)
    }
  }, [aberto, veiculo])

  function alterar(campo: keyof Formulario, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function autocompletarPessoa(campoCodigo: keyof Formulario, campoNome: keyof Formulario) {
    const codigo = code(form[campoCodigo])
    if (!codigo || form[campoNome].trim()) return
    const pessoa = colaboradores?.find((c) => code(c.codigo) === codigo)
    if (pessoa) alterar(campoNome, pessoa.nome)
  }

  function confirmar() {
    const placa = form.placa.trim().toUpperCase()
    if (!placa) {
      setErro('Informe a placa do veículo.')
      return
    }
    if (!form.tipo_veiculo) {
      setErro('Informe o tipo do veículo.')
      return
    }
    const duplicada = salvasExistentes.some(
      (v) => v.placa.toUpperCase() === placa && v.id !== veiculo?.id,
    )
    if (duplicada) {
      setErro('Esta placa já existe na Base Fidelização.')
      return
    }
    setSalvando(true)
    onSalvar({
      id: veiculo?.id,
      veiculo: {
        placa,
        tipo_veiculo: form.tipo_veiculo,
        frota: form.frota.trim(),
        disponibilidade: form.disponibilidade,
        motorista_fixo_codigo: code(form.motorista_fixo_codigo),
        motorista_fixo_nome: form.motorista_fixo_nome.trim(),
      },
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {veiculo ? `Editar veículo · ${veiculo.placa}` : 'Adicionar veículo'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="placa">Placa *</Label>
            <Input
              id="placa"
              value={form.placa}
              onChange={(e) => alterar('placa', e.target.value.toUpperCase())}
              placeholder="Ex.: QYD5580"
              maxLength={12}
            />
          </div>
          <div className="grid gap-2">
            <Label>Tipo veículo *</Label>
            <Select
              value={form.tipo_veiculo || undefined}
              onValueChange={(v) => alterar('tipo_veiculo', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_VEICULO.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="frota">Frota</Label>
            <Input
              id="frota"
              value={form.frota}
              onChange={(e) => alterar('frota', e.target.value)}
              placeholder="Código da frota"
            />
          </div>
          <div className="grid gap-2">
            <Label>Disponibilidade</Label>
            <Select
              value={form.disponibilidade || 'vazio'}
              onValueChange={(v) => alterar('disponibilidade', v === 'vazio' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vazio">Sem status</SelectItem>
                {SITUACOES_DISPONIBILIDADE.filter((s) => s.valor).map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cod-m">Cód. Motorista fixo</Label>
            <Input
              id="cod-m"
              value={form.motorista_fixo_codigo}
              onChange={(e) => alterar('motorista_fixo_codigo', e.target.value)}
              onBlur={() => autocompletarPessoa('motorista_fixo_codigo', 'motorista_fixo_nome')}
              placeholder="Código"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nome-m">Motorista fixo</Label>
            <Input
              id="nome-m"
              value={form.motorista_fixo_nome}
              onChange={(e) => alterar('motorista_fixo_nome', e.target.value)}
              placeholder="Nome do motorista"
            />
          </div>
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {veiculo ? 'Salvar alterações' : 'Adicionar veículo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
