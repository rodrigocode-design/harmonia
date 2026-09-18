# Operação, backup e incidentes

## Publicação

1. Executar `pnpm test`, `pnpm lint` e `pnpm build`.
2. Aplicar migrações em homologação e validar restauração.
3. Configurar identidade, MFA, domínio e segredos no ambiente protegido.
4. Publicar primeiro em homologação, executar smoke/E2E e só então promover.
5. Registrar versão, migrações, responsável, data e plano de rollback.

Migrações são cumulativas em `drizzle/`. Nunca edite uma migração já aplicada em produção; crie uma nova e ensaie a reversão compatível. A migração `0002` retropreenche a sequência dos pagamentos antes de ativar o índice concorrente por cobrança.

## Backup e restauração

Política mínima proposta:

- D1: exportação criptografada diária, retenção de 35 cópias diárias e 12 mensais;
- R2: versionamento/proteção contra exclusão conforme suporte contratado e inventário diário de objetos;
- segredos e configuração: backup separado, criptografado, com acesso de duas pessoas;
- chaves: rotação e cópia de recuperação em cofre diferente do backup;
- teste de restauração trimestral em ambiente isolado, com evidência e tempo medido;
- metas iniciais para validação de negócio: RPO de 24 h e RTO de 8 h.

Procedimento:

1. Declarar incidente de recuperação e congelar mutações quando necessário.
2. Escolher ponto consistente entre banco e objetos.
3. Restaurar em ambiente isolado, validar checksums, migrações e contagens.
4. Testar login, agenda, arquivos, relatório, cobrança e auditoria.
5. Aprovar retorno com direção e segurança; registrar lacuna de dados e lições.

Backups e testes periódicos dependem da infraestrutura/contrato de produção e não são ativados apenas pelo código da aplicação.

## Resposta a incidentes

1. **Detectar e triar:** severidade, escola afetada, dados, período e fonte.
2. **Conter:** revogar sessão/chave, bloquear rota ou integração e preservar evidências.
3. **Erradicar:** corrigir causa, dependência ou configuração; revisar acessos relacionados.
4. **Recuperar:** restaurar serviço gradualmente, monitorar reincidência e validar integridade.
5. **Notificar:** encarregado e jurídico avaliam titulares, ANPD, contratos e prazos aplicáveis.
6. **Aprender:** post-mortem sem culpa, ações com responsáveis/prazos e atualização do modelo de ameaças.

Não copie relatórios, tokens, arquivos ou dados pessoais completos para tickets ou canais de crise. Use identificadores e cofre de evidências com acesso restrito.

## Monitoramento recomendado

- disponibilidade, latência e taxa de erro por rota;
- falhas de autenticação no provedor e mudanças de função;
- `DENIED`, picos de `429`, tentativas de download e exportações incomuns;
- fila/idade de arquivos em quarentena;
- falhas de notificação e processamento de relatório;
- integridade e crescimento do log de auditoria;
- vencimento de certificado, domínio, chaves e backups;
- dependências críticas e CVEs exploradas.

## Continuidade

Manter contatos, fornecedores, dependências, runbooks e responsáveis fora da própria aplicação. Ensaio semestral deve incluir indisponibilidade do provedor de identidade, D1, R2 e canal de comunicação.
