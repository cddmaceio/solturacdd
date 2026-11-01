# Consulta Clientes

A aba Consulta Clientes usa a permissão `bases.visualizar`. A importação exige `bases.editar`. O PCD permite consultar os nomes aos usuários com `pcd.visualizar`.

Importe separadamente os CSVs delimitados por ponto e vírgula:

- **Base clientes:** `Cód. cliente` e `Nome fantasia`.
- **Base roteirizador:** `Código Cliente`, `Nome Cliente`, `Endereço`, `Latitude`, `Longitude`, `Setor`, `Data última compra` e `Data penúltima compra`. Cidade, estado e `Data antepenúltima compra` são opcionais.

O prefixo `157` é removido apenas do código importado do roteirizador. Zeros à esquerda são normalizados. O nome fantasia tem prioridade sobre o nome do roteirizador. Clientes presentes em uma só base também aparecem, com indicação da fonte.

A importação adiciona ou atualiza por código e preserva os códigos ausentes no arquivo. A última linha de um código repetido prevalece. Linhas sem código numérico ou nome são ignoradas, com contagem na confirmação. Datas inválidas impedem a importação. Cada arquivo é salvo em uma transação, sem alterar a outra base.

O mapa usa OpenStreetMap e oferece link para Google Maps. Coordenadas vazias, fora dos limites ou iguais a (0, 0) não geram mapa. O relatório fornecido contém última e penúltima compra; a antepenúltima aparece como não informada até ser incluída em uma importação.

No PCD, clique em **Ver nomes** na coluna Clientes para abrir a lista com código, nome, setor e cidade. A lista elimina códigos repetidos e permite filtrar. Clique no nome para abrir os detalhes na Consulta Clientes.

Na **Escala do dia**, o ícone de olho ao lado da placa abre o mapa de clientes do veículo. São considerados todos os mapas vinculados à linha da escala, incluindo pendências e os mapas preservados no histórico. Clientes repetidos aparecem uma vez, com os números dos mapas de origem. Clique em um ponto ou no nome da lista para consultar sua posição. Clientes sem cadastro ou coordenadas válidas são indicados na lista. Clientes com as mesmas coordenadas compartilham um ponto, cujo balão lista todos os nomes. O mapa é carregado apenas ao abrir a janela e usa Leaflet com OpenStreetMap; não exige nova migration.

Banco: `supabase/migrations/20261031120000_consulta_clientes.sql`. A view utiliza as permissões de leitura das tabelas e a função de importação exige permissão de edição.

Validação: `npm test`, `npm run build`, `npm run lint`. Para o teste SQL, execute `node scripts/test-clientes-sql.mjs` com `PGLITE_MODULE` apontando para o módulo PGlite instalado. As variáveis opcionais `BASE_CLIENTES_CSV` e `BASE_ROTEIRIZADOR_CSV` habilitam a validação integral dos CSVs locais, sem copiá-los para o repositório.
