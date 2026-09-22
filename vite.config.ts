import vinext from "vinext";
import { defineConfig } from "vite";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

// Este mesmo objeto alimenta tanto o `vite dev`/Miniflare local quanto o
// wrangler.json gerado em `pnpm build` (usado pelo deploy real). Os valores de
// D1/R2 abaixo já são os recursos de produção criados na conta Cloudflare do
// projeto (dash.cloudflare.com), então funcionam nos dois casos: em dev local
// o Miniflare só usa o `database_id`/`bucket_name` como rótulo (não acessa a
// nuvem), e em produção o `wrangler deploy` usa esses mesmos IDs pra conectar
// no D1/R2 reais. Se algum dia for necessário trocar de conta/projeto, troque
// os dois valores abaixo (database_id, bucket_name).
//
// IMPORTANTE: SESSION_SECRET NÃO fica aqui. Este arquivo vai para um
// repositório público no GitHub, então qualquer segredo colocado em `vars`
// ficaria visível para qualquer pessoa. O segredo de produção é configurado
// direto no painel da Cloudflare (Worker > Settings > Variables and Secrets,
// como "Secret", não "Text") depois que o Worker existir.
const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: "harmonia-db",
      database_id: "9531e2fd-8984-4d2c-914a-9982e29be26d",
    },
  ],
  r2_buckets: [
    {
      binding: "BUCKET",
      bucket_name: "harmonia-files",
    },
  ],
};

export default defineConfig(async () => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
