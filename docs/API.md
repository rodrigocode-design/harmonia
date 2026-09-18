# API da Harmonia

Contrato completo em [`openapi.yaml`](../openapi.yaml). Todas as respostas privadas incluem `Cache-Control: no-store`; mutações exigem origem válida, identidade gerenciada, função ativa autorizada e `Idempotency-Key` aleatória entre 12 e 100 caracteres.

## Endpoints

| Método e rota | Uso | Proteções principais |
|---|---|---|
| `GET /api/app?role=...` | Visão agregada e já filtrada do portal | autenticação, função atribuída, escopo por escola/proprietário |
| `POST /api/app` | Casos de uso por `action` | CSRF, RBAC, Zod, rate limit por usuário/IP, idempotência, auditoria |
| `POST /api/files` | Upload privado | formatos/assinatura/tamanho/cota, nome aleatório, R2 privado, quarentena |
| `GET /api/files/{id}` | Download privado | reautorização a cada acesso, somente arquivo `CLEAN`, sem URL pública |
| `DELETE /api/files/{id}` | Exclusão lógica e física | propriedade/permissão, auditoria |
| `GET /api/export?type=...&format=...` | CSV ou PDF identificado | filtros de autorização, neutralização de fórmula em CSV, marca d'água |

## Ações implementadas em `/api/app`

`create_lesson`, `cancel_lesson`, `record_attendance`, `create_task`, `submit_task`, `review_submission`, `transition_report`, `create_event`, `rsvp_event`, `create_announcement`, `acknowledge_announcement`, `add_practice`, `record_payment` e `create_student`.

Exemplo:

```http
POST /api/app HTTP/1.1
Content-Type: application/json
Idempotency-Key: 2c1083ab-7e68-4a6e-b1d8-65824686b427
X-Harmonia-Role: SECRETARIA

{
  "action": "create_lesson",
  "payload": {
    "title": "Piano · aula individual",
    "teacherId": "identificador-publico",
    "studentIds": ["identificador-publico"],
    "startsAt": "2026-10-05T15:00:00-03:00",
    "endsAt": "2026-10-05T16:00:00-03:00",
    "bufferMinutes": 10,
    "modality": "IN_PERSON",
    "recurring": false,
    "occurrences": 1,
    "useMakeupCredit": false
  }
}
```

Erros usam mensagem pública curta, sem stack trace nem detalhes de banco. Códigos usuais: `400` validação, `401` sessão, `403` autorização, `409` concorrência/estado, `429` limite e `500` falha inesperada.
