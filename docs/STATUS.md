# Estado da entrega

Esta lista distingue software executável de interface preparada ou dependência operacional. Nenhuma integração externa desativada é apresentada como concluída.

## Concluído nesta versão

- PWA responsiva e instalável no celular e no computador, com navegação lateral/mobile e cache seguro apenas de assets públicos.
- Entrada autenticada pela plataforma, múltiplas funções, seletor de contexto, RBAC no servidor e escopo de aluno/professor/responsável.
- Banco relacional real, 59 tabelas, migrações, isolamento por `school_id` e demonstração sintética.
- Dashboards distintos para direção, secretaria, professor, aluno/responsável e financeiro; a secretaria recebe janelas livres, professores disponíveis e créditos de reposição calculados do banco.
- Agenda em dia, semana, mês e lista; filtros; criação simples/recorrente; validação de antecedência, duração, disponibilidade, bloqueio, professor, aluno, sala, instrumento e intervalo.
- Confirmação transacional contra dupla reserva e consumo único de crédito de reposição.
- Presença e diário de aula individual, inclusive observação privada e geração de reposição.
- Tarefas publicadas/rascunho, entrega em texto/link, múltiplas versões, feedback privado, nota/conceito e solicitação de revisão.
- Estados/versionamento de relatório, visibilidade apenas quando publicado e PDF identificado.
- Indicadores agregados com fonte, período, tamanho da amostra e sem ranking.
- Evento com capacidade, confirmação e lista de espera; eventos e avisos segmentados por perfil, unidade, curso ou turma; confirmação de leitura.
- Diário de prática com compartilhamento opcional, repertório, metas e linha do tempo.
- Cadastro de aluno, visão de salas/instrumentos, cobranças e registro idempotente de pagamentos com controle concorrente de saldo.
- Busca global já limitada ao conjunto retornado ao perfil; agenda em CSV com proteção contra fórmula.
- Upload privado com assinatura real, limites, cota, nomes aleatórios, quarentena e autorização no download.
- Auditoria dos fluxos críticos de negócio, rate limiting por usuário/IP e cabeçalhos de segurança.
- Testes unitários e de integração dos controles críticos e suíte E2E executável contra Worker local/homologação.

## Parcial — núcleo ou modelo pronto, fluxo ainda incompleto

| Área | Já existe | Falta para operação completa |
|---|---|---|
| Agenda avançada | séries, exceções, travas, cancelamento e créditos no domínio/API | editor “esta/próximas/todas”, solicitação do aluno, tela de bloqueios, lista de espera de aulas e lembretes |
| Turmas | modelo de turma/matrícula/professor e participantes múltiplos na API | editor completo, chamada rápida multi-aluno e capacidade específica da turma no agendador |
| Disponibilidade | modelo, dados e verificação no servidor | tela de CRUD do professor/secretaria e aprovação de exceções |
| Tarefas/arquivos | endpoint privado e versões | seletor de upload ligado ao formulário, materiais da tarefa e feedback em áudio/vídeo |
| Relatório mensal | estados, versão, revisão, publicação/retificação e PDF | editor completo dos campos e criação mensal automática |
| Indicadores | aulas, horas, taxa de registro e amostra | cancelamentos detalhados, tempo de correção, pontualidade, continuidade e filtros persistidos |
| Eventos/avisos | criação, segmentação autorizada, RSVP, lotação, espera, aviso e leitura | check-in, anexos e promoção automática da lista de espera após desistência |
| Pessoas | aluno e vínculos no modelo | telas CRUD completas de responsáveis, matrículas, cursos, turmas e convites reais |
| Recursos | sala, recursos, patrimônio, empréstimo/manutenção no modelo | CRUD e assinatura de termo de responsabilidade |
| Substituição | ausência e substituição modeladas | solicitação, busca, aprovação e UI operacional |
| Financeiro | planos, cobranças, pagamentos e escopo | CRUD de planos/descontos/bolsas, recibo formal, conciliação e gateway |
| Privacidade | consentimentos, retenção configurável e escopo | portal do titular, jobs de retenção/anonimização e workflow jurídico |

## Dependente de serviço ou configuração externa

- MFA, sessão, recuperação de conta e eventos de autenticação: provedor de identidade/tenant.
- Antimalware/CDR: provedor precisa ser conectado; até lá uploads permanecem `QUARANTINED` e não são baixáveis.
- E-mail, WhatsApp oficial e Google Calendar: interfaces/configuração previstas, integrações desativadas.
- Monitoramento de erros, disponibilidade e alertas: contratar/configurar destino e regras.
- Backups criptografados, retenção, restauração e continuidade: configurar na infraestrutura e ensaiar.
- Gateway de pagamento, recibos fiscais e conciliação: fornecedor e validação fiscal.
- Publicação em App Store/Google Play: a entrega atual é PWA, não pacote nativo de loja.

## Critérios de aceite

| Critério | Estado |
|---|---|
| encontrar horário e agendar sem conflito | concluído |
| aluno/responsável vê aula do próprio escopo | concluído |
| professor registra presença e conteúdo | concluído |
| professor publica tarefa | concluído |
| aluno entrega em privado | concluído para texto/link; arquivo depende de scanner/UI |
| professor corrige e pede revisão | concluído |
| relatório elaborado, revisado e publicado | parcial: workflow pronto; editor completo pendente |
| direção consulta indicadores coerentes | concluído no conjunto inicial de métricas |
| eventos e avisos segmentados | concluído para perfil, unidade, curso e turma |
| ações respeitam permissões | concluído nos fluxos implementados |
| arquivo sem URL pública permanente | concluído |
| fluxos críticos auditados | concluído nos fluxos implementados; login/logout dependem do provedor |
| celular e desktop | concluído como PWA responsiva |
| demonstração sem dados pessoais reais | concluído |
| build, migrações e testes críticos | concluído nesta entrega: tipagem, lint, 15 testes de domínio e 8 E2E aprovados |
