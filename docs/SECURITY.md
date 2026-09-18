# Segurança

Baseline de desenvolvimento: [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) e [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/). Este checklist registra controles do produto; não equivale a certificação, pentest ou garantia de conformidade.

## Implementado

- [x] autenticação delegada ao ambiente gerenciado; senha não passa pela aplicação;
- [x] autorização no servidor, negação padrão, RBAC, propriedade/vínculo e filtro por `school_id`;
- [x] contexto ativo validado contra funções efetivamente atribuídas;
- [x] consultas parametrizadas e payloads validados por Zod com limites explícitos;
- [x] proteção same-origin para mutações e dados privados com `no-store`;
- [x] rate limiting por identidade e IP pseudonimizados, separado por operação;
- [x] idempotência em mutações e pagamento; cobranças usam versão única para impedir saldo excedido em concorrência;
- [x] agendamento transacional com índices únicos contra corrida;
- [x] histórico/versionamento de entrega e relatório;
- [x] mensagens de erro sem stack trace, SQL ou detalhes internos;
- [x] cabeçalhos CSP, HSTS, `nosniff`, anti-frame, referrer e permissions policy;
- [x] auditoria de agenda, presença, tarefas, relatórios, arquivos, exportações e financeiro;
- [x] metadados de auditoria sem corpo pedagógico, documento, token, endereço IP ou user-agent em claro;
- [x] CSV neutraliza células que poderiam executar fórmulas;
- [x] PWA não guarda páginas, respostas de API ou arquivos privados;
- [x] upload limita extensão, assinatura binária, tamanho, cota e nome; renomeia com UUID;
- [x] R2 privado, quarentena, download reautorizado e sem URL pública permanente;
- [x] dados demonstrativos sintéticos com domínio `.invalid`.

## Obrigatório antes de dados reais

- [ ] habilitar MFA obrigatório para administração, direção, secretaria e financeiro no provedor;
- [ ] revisar sessão, expiração, revogação, recuperação e prevenção de enumeração no provedor de identidade;
- [ ] integrar eventos de login, logout e falhas relevantes do provedor ao log de auditoria da escola;
- [ ] integrar antimalware/CDR e liberar arquivo somente após callback autenticado;
- [ ] remover metadados EXIF/ID3 quando compatível com a finalidade;
- [ ] mover segredos opcionais a um cofre e instituir rotação;
- [ ] validar CSP gerada no ambiente final e retirar `unsafe-inline` quando o runtime permitir nonces/hashes;
- [ ] executar SAST, SCA, secret scan, SBOM, DAST e pentest independente;
- [ ] configurar alertas de autenticação suspeita, exportação volumosa e ações administrativas;
- [ ] definir política de correção de dependências e SLA por severidade;
- [ ] validar criptografia em repouso, chaves, residência e suboperadores contratados;
- [ ] realizar teste de carga, abuso de upload e negação de serviço;
- [ ] revisar acessibilidade WCAG 2.2 AA com ferramentas e usuários reais.

## Upload seguro

O fluxo segue a orientação da [OWASP para upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): lista permitida, extensão e assinatura, tamanho/cota, nome gerado, armazenamento fora da aplicação e autorização no download. `Content-Type` do navegador não é usado como prova.

Formatos: PDF até 15 MB; PNG/JPEG/WebP até 10 MB; MP3/MP4/WebM até 24 MB; cota demonstrativa de 500 MB por usuário. Esses números devem ser parametrizados por escola e avaliados operacionalmente.

## Modelo de ameaças prioritário

| Ameaça | Controle | Teste/monitoramento |
|---|---|---|
| troca de ID (IDOR) | UUID + propriedade/vínculo + `school_id` | testes negativos por perfil |
| dupla reserva | trava única por recurso/slot em transação | teste concorrente |
| XSS/injeção | React escaping, Zod, CSP e SQL parametrizado | payloads maliciosos + DAST |
| CSRF | same-origin, sessão gerenciada e SameSite do provedor | requests cross-site |
| arquivo malicioso | assinatura, cota, quarentena e R2 privado | corpus inválido + scanner |
| vazamento em cache | `no-store`; SW só de assets públicos | inspeção Cache Storage/CDN |
| abuso de exportação | escopo, auditoria, identificação e rate limit | alerta por volume |
| privilégio indevido | RBAC, contexto validado e acesso administrativo auditado | regressão de autorização |
