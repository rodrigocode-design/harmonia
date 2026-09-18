# Harmonia

Sistema operacional responsivo para escola de música. A aplicação reúne agenda, presença, tarefas e entregas, relatórios mensais, indicadores contextualizados, eventos, comunicação, prática, repertório, pessoas, recursos, financeiro básico, auditoria e configurações.

Ela funciona no navegador do computador e do celular e pode ser instalada como PWA. O service worker guarda apenas ícones e arquivos estáticos versionados; páginas, APIs e qualquer dado privado continuam sempre online e fora do cache local.

## Stack

- Next.js 16 + TypeScript + React 19
- Cloudflare Workers via Vinext
- Cloudflare D1 (SQLite) + Drizzle ORM
- Cloudflare R2 privado para arquivos
- autenticação gerenciada por Sites/ChatGPT
- Zod para validação compartilhada
- Node Test Runner para testes unitários, integração e E2E

## Execução local

Requisitos: Node.js 22.13+ e pnpm 11.

```bash
pnpm install
pnpm db:generate
pnpm build
```

Aplique as migrações no D1 local e inicie o Worker:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lying_martin_li.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_glossy_bruce_banner.sql
pnpm start -- --port 8787
```

No ambiente hospedado, os cabeçalhos de identidade são fornecidos pela camada de autenticação. Em desenvolvimento automatizado, os testes E2E usam somente identidades fictícias com domínio `.invalid`.

```bash
pnpm test
E2E_BASE_URL=http://127.0.0.1:8787 pnpm test:e2e
pnpm lint
pnpm build
```

## Estrutura principal

```text
app/                 interface, PWA e rotas de API
components/ui/       componentes acessíveis
db/                  modelo Drizzle e bindings D1/R2
drizzle/             migrações SQL
lib/access.ts        matriz RBAC e regras de propriedade
lib/server/          contexto autenticado e casos de uso
tests/               testes unitários, integração e E2E
docs/                arquitetura, operação, segurança e LGPD
openapi.yaml         contrato HTTP
```

## Documentação

- [Matriz de permissões](docs/PERMISSIONS.md)
- [API](docs/API.md)
- [Arquitetura e decisões](docs/ARCHITECTURE.md)
- [Segurança](docs/SECURITY.md)
- [LGPD e revisão jurídica](docs/LGPD.md)
- [Backup, restauração e incidentes](docs/OPERATIONS.md)
- [Escopo concluído, parcial e externo](docs/STATUS.md)

## Observação jurídica

O software fornece controles técnicos de privacidade, minimização, rastreabilidade e retenção configurável. Hipóteses legais, tratamento de dados de menores, textos de consentimento, prazos e atendimento aos titulares precisam ser validados pelo encarregado e por assessoria jurídica antes do uso com dados reais.
