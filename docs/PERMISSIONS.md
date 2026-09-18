# Matriz de permissões

O backend aplica RBAC e escopo do registro. A interface apenas reflete as permissões; esconder um botão nunca é considerado autorização. A política padrão é negar.

| Área | Admin | Direção | Secretaria | Coordenação | Professor | Aluno | Responsável | Financeiro |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Dashboard geral | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ limitado |
| Agenda geral | ✓ | ✓ | ✓ | leitura | — | — | — | — |
| Agenda própria/vinculada | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Criar/remarcar/cancelar aula | ✓ | ✓ | ✓ | — | — | solicitação futura | solicitação futura | — |
| Disponibilidade própria | ✓ | — | — | — | ✓ | — | — | — |
| Presença e diário de aula | ✓ | — | — | — | próprio | — | leitura vinculada | — |
| Tarefas e correção | ✓ | — | — | apoio pedagógico | próprias | — | — | — |
| Entrega de tarefa | ✓ | — | — | — | — | própria | — | — |
| Relatório: elaborar | ✓ | — | — | — | próprios | — | — | — |
| Relatório: revisar/publicar | ✓ | ✓ | — | ✓ | — | — | — | — |
| Relatório publicado | ✓ | ✓ | ✓ | ✓ | escopo próprio | próprio | aluno vinculado | — |
| Indicadores gerais | ✓ | ✓ | — | ✓ | — | — | — | — |
| Indicadores próprios | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| Pessoas e matrículas | ✓ | ✓ | ✓ | leitura pedagógica | escopo próprio | próprio | vinculados | mínimo necessário |
| Eventos e avisos | ✓ | ✓ | ✓ | leitura | participação | participação | leitura | — |
| Financeiro completo | ✓ | ✓ | — | — | — | — | — | ✓ |
| Financeiro limitado | ✓ | ✓ | ✓ | — | — | configuração | vinculados | ✓ |
| Recursos e patrimônio | ✓ | ✓ | ✓ | — | — | — | — | — |
| Configurações e auditoria | ✓ | ✓ | — | — | — | — | — | — |

## Regras de propriedade

- Aluno: somente o próprio `student_id`.
- Responsável: somente alunos presentes em `guardian_links` e conforme os campos de autoridade financeira/agendamento.
- Professor: somente alunos ligados às suas aulas ou turmas ativas; presença e relatório exigem que seja o professor original ou substituto autorizado.
- Financeiro: consultas não retornam observações, feedbacks ou relatórios pedagógicos privados.
- Direção/administração: o acesso ampliado é auditado e sempre filtrado por `school_id`.
- Uma pessoa com múltiplas funções envia `x-harmonia-role`; o servidor aceita apenas funções realmente atribuídas à identidade.

Permissões granulares também estão modeladas em `permissions` e `role_permissions`, permitindo evolução sem misturar a regra de aplicação com a interface.
