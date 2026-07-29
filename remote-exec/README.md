# DataMind remote execution service

Roda a análise Python do DataMind fora do navegador, para datasets grandes demais
para o Pyodide (ver `datamind-run-remote` na pasta `supabase/functions/`). Isso é
código para **rodar no seu próprio servidor**, não faz parte do deploy do site.

## Deploy

1. Copie esta pasta (`remote-exec/`) para o servidor.
2. Crie um `.env` ao lado do `docker-compose.yml` com:
   ```
   DATAMIND_EXEC_TOKEN=<gere um valor aleatório longo, ex: openssl rand -hex 32>
   ```
3. `docker compose up -d --build`
4. Teste local: `curl http://localhost:8500/health` → `{"status":"ok"}`

## Expor via Cloudflare Tunnel

Na mesma tela de "Rotas de aplicativos publicados" do seu túnel, adicione uma rota
apontando para `http://localhost:8500` (ou o nome do serviço, se estiver na mesma
rede Docker do `cloudflared`), por exemplo `datamind-exec.posologia.app`.

Teste de fora da rede:
```
curl https://datamind-exec.posologia.app/health           # deve funcionar sem auth
curl -X POST https://datamind-exec.posologia.app/run       # sem token -> 401
```

## Configurar o Supabase

Defina estes secrets na function (`datamind-run-remote`), com `--project-ref` explícito:

```
npx supabase secrets set DATAMIND_EXEC_URL=https://datamind-exec.posologia.app --project-ref opogckyuwexdlczfvvtb
npx supabase secrets set DATAMIND_EXEC_TOKEN=<o mesmo valor do .env acima> --project-ref opogckyuwexdlczfvvtb
npx supabase secrets set DATAMIND_REMOTE_EXEC_OWNER_ID=<seu user.id no scholar.ai> --project-ref opogckyuwexdlczfvvtb
npx supabase functions deploy datamind-run-remote --project-ref opogckyuwexdlczfvvtb
```

E no `.env` do site (build do frontend):
```
VITE_DATAMIND_REMOTE_EXEC_OWNER_ID=<o mesmo user.id acima>
```

## Escopo e limites

- Só a conta cujo `user.id` bate com `DATAMIND_REMOTE_EXEC_OWNER_ID` consegue acionar
  isso — a verificação real é feita na edge function, não só no frontend.
- Cada execução roda em processo filho isolado, com timeout (`DATAMIND_EXEC_TIMEOUT`,
  padrão 90s) e teto de memória (`DATAMIND_EXEC_MEMORY_LIMIT_GB`, padrão 3GB — deixe
  headroom abaixo do `mem_limit` do container no `docker-compose.yml`).
- R não é suportado por aqui ainda — só Python.
- Isolamento é por container + processo com limite de recursos, não por
  container-por-execução. Adequado para uso de uma única conta com os próprios
  dados; não deve ser aberto para múltiplos usuários sem revisar isso.
