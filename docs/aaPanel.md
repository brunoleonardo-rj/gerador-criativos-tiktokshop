# Implantação futura no aaPanel

Este guia prepara uma publicação posterior; não publica DNS, certificado nem altera um servidor aaPanel nesta entrega.

## Preparação Linux

Use Node.js 20.19+ no host Linux. Faça `pnpm install --frozen-lockfile` e `pnpm build` no próprio host (ou num ambiente Linux compatível). Não copie `node_modules`, Prisma gerado nem binários nativos de SQLite do Windows.

Escolha um `DATA_DIR` absoluto, persistente, fora do diretório de release, por exemplo `/var/lib/gerador-criativos`. O usuário do processo Node deve ter apenas permissão de leitura/escrita nesse diretório. Antes de iniciar cada release, faça backup e execute:

```sh
pnpm db:migrate
pnpm build
```

Mantenha no ambiente do processo `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `TRUSTED_PROXY_SECRET`, `SETTINGS_ENCRYPTION_KEY` e `DATA_DIR`. Rode o processo standalone por meio do gerenciador de processos do aaPanel:

```sh
node .next/standalone/server.js
```

Copie também `.next/static` para `.next/standalone/.next/static` e `public` para `.next/standalone/public`.

## Proxy reverso Nginx

O Node deve escutar somente em loopback/rede privada; ele não deve ser exposto publicamente. Termine HTTPS no Nginx e encaminhe o IP do cliente apenas após autenticar a borda com o segredo de proxy.

```nginx
server {
    listen 443 ssl http2;
    server_name exemplo.seudominio.com;

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Trusted-Client-Ip $remote_addr;
        proxy_set_header X-Trusted-Proxy-Secret "SUBSTITUA_PELO_TRUSTED_PROXY_SECRET";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 120s;
    }
}
```

`client_max_body_size 60m` é deliberado: o endpoint aceita até 56 MiB agregados. O cabeçalho `X-Trusted-Client-Ip` só é confiável porque o Nginx sobrescreve `X-Trusted-Proxy-Secret`; remova cabeçalhos recebidos do cliente nessa borda se a configuração local os preservar. Os headers Upgrade/Connection cobrem WebSocket se alguma camada futura o exigir.

## Backup, restore e rotação

Faça backup consistente de `$DATA_DIR/app.db` e de `$DATA_DIR/library/versions` antes de migrações ou atualizações da biblioteca. Para restaurar, pare o processo, restaure ambos do mesmo ponto no tempo, confirme permissões e inicie novamente. Rotacione `AUTH_SECRET`, `TRUSTED_PROXY_SECRET` e `SETTINGS_ENCRYPTION_KEY` por procedimento controlado: a troca de `AUTH_SECRET` invalida sessões; a chave de criptografia exige recriptografar a credencial armazenada antes de descartar a anterior. Nunca registre esses valores em Nginx, shell history, repositório ou logs.
