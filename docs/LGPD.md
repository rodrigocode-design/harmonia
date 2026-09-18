# Checklist LGPD para revisão jurídica

Referência operacional: [materiais e guias oficiais da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes). Este documento é um inventário inicial, não parecer jurídico. A escola, o encarregado e assessoria jurídica devem definir papéis, hipóteses legais, prazos e textos antes do tratamento de dados reais.

## Inventário inicial de dados

| Categoria | Finalidade necessária | Hipótese a avaliar | Acesso | Retenção inicial sugerida* | Compartilhamento provável |
|---|---|---|---|---|---|
| identidade e contato | conta, comunicação e segurança | contrato, obrigação legal ou consentimento conforme caso | secretaria/admin; mínimo por área | vínculo + prazo legal | provedor de identidade/e-mail |
| responsável e menor | proteção, autorização e execução do serviço | melhor interesse, contrato e regras específicas de menores | secretaria e perfis vinculados | vínculo + prazo legal | prestadores essenciais |
| agenda e presença | prestação das aulas e reposições | execução contratual/legítimo interesse a validar | envolvidos e gestão | ciclo acadêmico + defesa de direitos | calendário somente por opção |
| conteúdo pedagógico | acompanhamento e relatório | execução contratual; analisar dados sensíveis incidentais | professor responsável, coordenação, aluno/vínculo | política acadêmica documentada | nenhum por padrão |
| áudio, vídeo e imagem | entrega, feedback ou evento específico | base por finalidade; autorização específica quando aplicável | destinatários autorizados | mínimo necessário | storage/processador/antimalware |
| financeiro | cobrança, recibo e contabilidade | contrato e obrigação legal | financeiro; visão limitada da secretaria/família | prazo fiscal/contábil | contador/gateway futuro |
| comunicações e preferências | avisos operacionais | contrato/legítimo interesse; consentimento para canal opcional | comunicação/admin | enquanto preferência ou vínculo | e-mail/WhatsApp oficial opcional |
| segurança e auditoria | prevenir fraude, investigar incidentes e prestar contas | legítimo interesse/obrigação a validar | segurança/direção autorizada | 60 meses configuráveis | monitoramento autorizado |

\* Apenas ponto de partida técnico; deve ser substituído por tabela de temporalidade aprovada.

## Controles do sistema

- [x] minimização por perfil e separação entre financeiro e pedagógico;
- [x] conteúdo privado não aparece em URL pública permanente;
- [x] `consents` registra finalidade, hipótese informada, versão do texto, origem, concessão e revogação;
- [x] políticas de retenção podem ser guardadas nas configurações da escola;
- [x] auditoria pseudonimiza IP e user-agent e evita conteúdo completo;
- [x] relatórios só aparecem à família quando publicados;
- [x] histórico de versões preserva retificações;
- [x] vínculos de responsável possuem autoridade financeira e de agenda separadas;
- [x] não há biometria, reconhecimento facial, análise emocional, publicidade ou treinamento de IA;
- [x] diário de prática é voluntário, o aluno controla o compartilhamento com professor e o responsável não recebe esses registros por padrão.

## Decisões humanas obrigatórias

- [ ] nomear controlador, operadores, encarregado e canal do titular;
- [ ] mapear fluxo de cada dado, sistema, integração, suboperador e país;
- [ ] definir hipótese legal por finalidade sem presumir consentimento;
- [ ] conduzir avaliação específica para crianças/adolescentes e documentar melhor interesse;
- [ ] aprovar aviso de privacidade em linguagem clara e versão apropriada para menores;
- [ ] decidir quando autorização do responsável é necessária e como verificar sua identidade;
- [ ] concluir RIPD quando indicado pela análise de risco;
- [ ] definir retenção, bloqueio, anonimização e exclusão por categoria e obrigação legal;
- [ ] firmar contratos com operadores e avaliar transferências internacionais;
- [ ] documentar teste de balanceamento quando a base escolhida for legítimo interesse;
- [ ] definir resposta a acesso, confirmação, correção, informação, oposição, revogação, portabilidade e eliminação quando aplicável;
- [ ] estabelecer procedimento de incidente e critérios/prazos de comunicação aplicáveis;
- [ ] registrar treinamento periódico e revisão anual do inventário.

## Fluxo recomendado para solicitação de titular

1. Registrar a solicitação sem incluir documentos desnecessários no chamado.
2. Verificar identidade de modo proporcional, com cuidado especial para responsáveis.
3. Localizar dados por escola, usuário e alunos vinculados; bloquear alterações conflitantes.
4. Avaliar exceções e obrigações de retenção com jurídico/encarregado.
5. Exportar apenas dados autorizados, em canal seguro e com identificação.
6. Corrigir, anonimizar ou excluir conforme decisão documentada.
7. Comunicar conclusão e guardar somente a evidência mínima do atendimento.

O modelo comporta o processo, mas um módulo automatizado completo de solicitações do titular não está implementado nesta versão.
