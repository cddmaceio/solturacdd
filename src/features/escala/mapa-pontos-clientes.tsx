import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ClienteVeiculo } from './clientes-veiculo'

export default function MapaPontosClientes({ pontos, selecionado }: { pontos: ClienteVeiculo[]; selecionado: string | null }) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const marcadores = useRef(new Map<string, L.Marker>())
  const [falhaTiles, setFalhaTiles] = useState(false)

  useEffect(() => {
    if (!container.current || !pontos.length) return
    const instancia = L.map(container.current)
    mapa.current = instancia
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(instancia)
    tiles.on('tileerror', () => setFalhaTiles(true))
    tiles.on('tileload', () => setFalhaTiles(false))
    const grupos = new Map<string, ClienteVeiculo[]>()
    for (const ponto of pontos) {
      const chave = `${ponto.cliente!.latitude},${ponto.cliente!.longitude}`
      grupos.set(chave, [...(grupos.get(chave) ?? []), ponto])
    }
    const icone = L.divIcon({
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:#1d4ed8;border:2px solid white;box-shadow:0 1px 5px #0008"></span>',
    })
    const markers = new Map<string, L.Marker>()
    for (const grupo of grupos.values()) {
      const primeiro = grupo[0].cliente!
      const popup = document.createElement('div')
      for (const ponto of grupo) {
        const bloco = document.createElement('div')
        bloco.style.marginBottom = '8px'
        const nome = document.createElement('strong')
        nome.textContent = `${ponto.codigo} · ${ponto.cliente!.nome}`
        const endereco = document.createElement('div')
        endereco.textContent = [ponto.cliente!.endereco, ponto.cliente!.cidade].filter(Boolean).join(' · ')
        const mapas = document.createElement('div')
        mapas.textContent = `Mapa(s): ${ponto.mapas.join(', ')}`
        bloco.append(nome, endereco, mapas)
        popup.append(bloco)
      }
      const marcador = L.marker([primeiro.latitude!, primeiro.longitude!], {
        icon: icone, title: grupo.map((p) => p.cliente!.nome).join(' · '),
        alt: grupo.map((p) => `Cliente ${p.codigo}`).join(', '),
      }).addTo(instancia).bindPopup(popup, { maxHeight: 250 })
      for (const ponto of grupo) markers.set(ponto.codigo, marcador)
    }
    marcadores.current = markers
    const ajustar = () => {
      instancia.invalidateSize()
      instancia.fitBounds(L.latLngBounds(pontos.map((p) => [p.cliente!.latitude!, p.cliente!.longitude!])), { padding: [32, 32], maxZoom: 16 })
    }
    const quadro = requestAnimationFrame(ajustar)
    const observer = new ResizeObserver(() => instancia.invalidateSize())
    observer.observe(container.current)
    return () => {
      cancelAnimationFrame(quadro)
      observer.disconnect()
      instancia.remove()
      mapa.current = null
      marcadores.current.clear()
    }
  }, [pontos])

  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    const marcador = selecionado ? marcadores.current.get(selecionado) : null
    if (marcador) {
      instancia.setView(marcador.getLatLng(), 17)
      marcador.openPopup()
    } else if (pontos.length) {
      instancia.closePopup()
      instancia.fitBounds(L.latLngBounds(pontos.map((p) => [p.cliente!.latitude!, p.cliente!.longitude!])), { padding: [32, 32], maxZoom: 16 })
    }
  }, [selecionado, pontos])

  return <div className="relative h-full min-h-80">
    <div ref={container} className="relative z-0 h-full min-h-80 w-full" aria-label="Mapa com os pontos dos clientes do veículo" />
    {falhaTiles && <p role="status" className="absolute inset-x-3 bottom-6 z-[1000] rounded bg-white/95 p-2 text-xs text-slate-700">Não foi possível carregar parte do mapa. Verifique a conexão com a internet.</p>}
  </div>
}
