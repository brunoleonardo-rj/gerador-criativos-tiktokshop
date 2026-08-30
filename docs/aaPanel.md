# Implantação futura no aaPanel

Este guia prepara uma publicação posterior; não publica DNS, certificado nem altera um servidor aaPanel nesta entrega.

## Preparação Linux

Use Node.js 20.19+ no host Linux. Faça `pnpm install --frozen-lockfile` e `pnpm build` no próprio host (ou num ambiente Linux compatível). Não copie `node_modules`, Prisma gerado nem binários nativos de SQLite do Windows.

Escolha um `DATA_DIR` absoluto, persistente, fora do diretório de release, por exemplo `/var/lib/gerador-criativos`. O usuário do processo Node deve ter apenas permissão de leitura/escrita nesse diretório. Antes de iniciar cada release, faça backup e execute:

```sh
pnpm db:migrate
pnpm build
```

Mantenha no ambiente do processo `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `TRUSTED_PROXY_SECRET`, `SETTINGS_ENCRYPTION_KEY` e `DATA_DIR`. Depois do build, execute `pnpm standalone:prepare` e rode somente o diretório materializado pelo gerenciador de processos do aaPanel:

```sh
HOSTNAME=127.0.0.1 PORT=3000 node .next/deploy/server.js
```

O materializador já inclui `.next/static` e `public`, eliminando links pnpm da entrega Windows/Linux.

## Proxy reverso Nginx

O Node deve escutar somente em loopback/rede privada; ele não deve ser exposto publicamente. Termine HTTPS no Nginx e encaminhe o IP do cliente apenas após autenticar a borda com o segredo de proxy.

```nginx
# contexto http (não dentro de server)
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name exemplo.seudominio.com;

    client_max_body_size 16k;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Trusted-Client-Ip $remote_addr;
    proxy_set_header X-Trusted-Proxy-Secret "SUBSTITUA_PELO_TRUSTED_PROXY_SECRET";
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 120s;

    location = /api/auth/login {
        client_max_body_size 16k;
        proxy_pass http://127.0.0.1:3000;
    }

    location = /api/settings {
        client_max_body_size 24k;
        proxy_pass http://127.0.0.1:3000;
    }

    location = /api/generate {
        client_max_body_size 60m;
        # Acima de GENERATION_TIMEOUT_MS (300s) para o timeout do app vencer e responder JSON.
        proxy_read_timeout 360s;
        proxy_send_timeout 360s;
        proxy_pass http://127.0.0.1:3000;
    }

    location = /api/library/import {
        client_max_body_size 60m;
        proxy_pass http://127.0.0.1:3000;
    }

    location = /api/product-extraction {
        client_max_body_size 26m;
        proxy_pass http://127.0.0.1:3000;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

O limite padrão e o login ficam em 16 KiB; Configurações permite 24 KiB para o template de até 20 KiB. Geração e importação recebem `client_max_body_size 60m`: geração aceita até 56 MiB agregados e a importação valida a planilha em até 20 MiB. A extração de produto recebe `client_max_body_size 26m`, acima de `MAX_PRODUCT_EXTRACTION_BODY_BYTES` (26 MiB) para o limite do próprio app vencer e responder JSON em vez do Nginx cortar a conexão com 413. O cabeçalho `X-Trusted-Client-Ip` só é confiável porque o Nginx sobrescreve `X-Trusted-Proxy-Secret`; remova cabeçalhos recebidos do cliente nessa borda se a configuração local os preservar. Os headers Upgrade/Connection cobrem WebSocket se alguma camada futura o exigir.

## Backup, restore e rotação

Faça backup consistente de `$DATA_DIR/app.db` e de `$DATA_DIR/library/versions` antes de migrações ou atualizações da biblioteca. Para restaurar, pare o processo, restaure ambos do mesmo ponto no tempo, confirme permissões e inicie novamente. Rotacione `AUTH_SECRET`, `TRUSTED_PROXY_SECRET` e `SETTINGS_ENCRYPTION_KEY` por procedimento controlado: a troca de `AUTH_SECRET` invalida sessões; a chave de criptografia exige recriptografar a credencial armazenada antes de descartar a anterior. Nunca registre esses valores em Nginx, shell history, repositório ou logs.
