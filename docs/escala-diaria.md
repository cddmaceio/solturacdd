# Arquivo diário da escala

Cada linha de `escalas` guarda um `snapshot` versão 1 com mapas completos,
referência do veículo e ajudante fidelizado. Os campos de equipe, sala e
observação continuam sendo editados na própria escala.

- O PCD pode acrescentar mapas apenas em hoje e datas futuras. A identidade é
  data de entrega + número do mapa + placa normalizada, independentemente do UUID.
- Em dias passados, mapas arquivados conservam seus dados e status. Em hoje e
  datas futuras, mapas anteriores explicitamente fechados no PCD saem das
  pendências, preservando equipes e mapas D0. Ausência no CSV não prova fechamento.
- Na entrada de um pernoite, o motorista vem do PCD. A dupla fidelizada automática
  é liberada; escolhas manuais têm prioridade. Folgas e outras ausências continuam
  impedindo que a pessoa apareça como disponível.
- Consultar uma data passada não cria linhas nem acrescenta mapas. Registros
  legados sem snapshot são sinalizados como histórico incompleto.
- Restaurar equipes não apaga os mapas arquivados. Alterar cadastros também não
  reescreve as equipes das escalas.
- Os destaques têm prioridade: pernoite amarelo, Gradativa laranja, Noturna cinza.
  A mesma regra vale na tela, na impressão e no Excel.
- Quando só há Chapa/PX, recolher o ajudante vazio é uma preferência visual;
  não remove nenhuma alocação.

## Persistência e implantação

A RPC `sincronizar_escala` executa as inclusões em uma transação por data, sob RLS,
reconsultando alocações manuais e conflitos. A tela informa falhas e oferece
nova tentativa. Aplicar a migração de schema antes de publicar o frontend.

A migração de recuperação associa o mapa 574742 de 26/09/2026 ao UHJ6F39 em
28/09/2026, conforme confirmação do supervisor. Preserva Nelson (296) e o
ajudante manual. Como a fase MPD original não foi arquivada, mostra
“Pernoite recuperado” e sinaliza essa limitação; os dados disponíveis do mapa
provêm do PCD consultado na recuperação.

## Verificação

`npm test`, `npm run build` e `npm run lint` verificam o aplicativo.
`scripts/test-escala-sql.mjs` verifica a migração e a RPC em PostgreSQL isolado
via PGlite; definir `PGLITE_MODULE` com o caminho para `@electric-sql/pglite/dist/index.js`.
PGlite é ferramenta de teste opcional e não faz parte das dependências do app.
