# Consulta Clientes

A aba Consulta Clientes usa a permissão `bases.visualizar`. A importação exige `bases.editar`. O PCD permite consultar os nomes aos usuários com `pcd.visualizar`.

A página abre sem baixar a base completa. Os totais são consultados em segundo plano, sem bloquear a pesquisa. A busca é executada no banco após uma pausa de 250 ms na digitação, com 50 resultados por página e navegação Anterior/Próxima. Nomes exigem pelo menos 3 caracteres e podem ser digitados sem acentos; códigos numéricos podem ser consultados diretamente. Códigos exatos têm prioridade sobre correspondências parciais. As buscas são armazenadas em cache por 5 minutos e atualizadas após importações.

Importe separadamente os CSVs delimitados por ponto e vírgula:

- **Base clientes:** `Cód. cliente` e `Nome fantasia`.
- **Base roteirizador:** `Código Cliente`, `Nome Cliente`, `Endereço`, `Latitude`, `Longitude`, `Setor`, `Data última compra` e `Data penúltima compra`. Bairro, cidade, estado e `Data antepenúltima compra` são opcionais.

O prefixo `157` é removido apenas do código importado do roteirizador. Zeros à esquerda são normalizados. O nome fantasia tem prioridade sobre o nome do roteirizador. Clientes presentes em uma só base também aparecem, com indicação da fonte.

A importação adiciona ou atualiza por código e preserva os códigos ausentes no arquivo. A última linha de um código repetido prevalece. Linhas sem código numérico ou nome são ignoradas, com contagem na confirmação. Datas inválidas impedem a importação. Cada arquivo é salvo em uma transação, sem alterar a outra base.

O mapa usa OpenStreetMap e oferece link para Google Maps. Coordenadas vazias, fora dos limites ou iguais a (0, 0) não geram mapa. O relatório fornecido contém última e penúltima compra; a antepenúltima aparece como não informada até ser incluída em uma importação.

No PCD, clique em **Ver nomes** na coluna Clientes para abrir a lista com colunas de código, nome, setor, bairro e cidade. A lista elimina códigos repetidos e permite filtrar por todos esses campos. Clique no nome para abrir os detalhes na Consulta Clientes. O relatório original não inclui bairro; esse campo permanece não informado até ser importado em uma coluna `Bairro`. Um setor não é tratado como confirmação do bairro. Novas importações sem bairro preservam o valor já cadastrado.

Na **Escala do dia**, o ícone de olho ao lado da placa abre o mapa de clientes do veículo. São considerados todos os mapas vinculados à linha da escala, incluindo pendências e os mapas preservados no histórico. Clientes repetidos aparecem uma vez, com os números dos mapas de origem. Clique em um ponto ou no nome da lista para consultar sua posição. Clientes sem cadastro ou coordenadas válidas são indicados na lista. Clientes com as mesmas coordenadas compartilham um ponto, cujo balão lista todos os nomes. O mapa é carregado apenas ao abrir a janela e usa Leaflet com OpenStreetMap; não exige nova migration.

O PCD e o mapa da escala carregam somente os códigos dos clientes vinculados ao mapa/veículo, em lotes de até 100 códigos e até 4 requisições simultâneas. Nenhum desses fluxos precisa baixar todos os cadastros.

Banco: `supabase/migrations/20261031120000_consulta_clientes.sql`. A view utiliza as permissões de leitura das tabelas e a função de importação exige permissão de edição.

Otimização da consulta: `supabase/migrations/20261101010000_otimizar_consulta_clientes.sql`. Adiciona a busca paginada, índices de nomes/códigos com `pg_trgm` e avaliação das permissões uma vez por consulta. A função mantém as regras de acesso das tabelas. Valide com `node scripts/test-clientes-busca-sql.mjs`, usando a mesma variável `PGLITE_MODULE`.

Bairro: `supabase/migrations/20261101011000_cliente_bairro.sql`. Adiciona o campo opcional e o disponibiliza na consulta e nas importações.

Validação: `npm test`, `npm run build`, `npm run lint`. Para o teste SQL, execute `node scripts/test-clientes-sql.mjs` com `PGLITE_MODULE` apontando para o módulo PGlite instalado. As variáveis opcionais `BASE_CLIENTES_CSV` e `BASE_ROTEIRIZADOR_CSV` habilitam a validação integral dos CSVs locais, sem copiá-los para o repositório.
