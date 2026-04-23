# Jokr Platform — Monorepo

Plataforma interna de ferramentas operacionais da Jokr.

## Estrutura

```
jokr/
├── apps/
│   └── management-test/             # Data Management QA Testing — Geração de teste + Purchase Order
│       ├── client/              # Frontend (HTML/CSS/JS)
│       │   ├── pages/           # index.html
│       │   ├── styles/          # main.css (consolidado, dark theme)
│       │   └── lib/             # app.js, db.js
│       └── server/              # Backend Node/Express
│           ├── config/          # sf.config.js
│           ├── middleware/      # logger, errorHandler
│           ├── routes/          # sf, vendor, po
│           └── services/        # vendor, po, nfkey, inventory
│
├── packages/
│   ├── salesforce/              # Cliente OAuth2 SF compartilhado
│   ├── db/                      # IndexedDB wrapper (browser)
│   └── ui-kit/                  # Design tokens base
│
├── infra/scripts/
│   ├── start.sh                 # Inicia apps
│   └── free-port.sh             # Libera porta ocupada
│
├── .env                         # Credenciais (não commitar)
├── .env.example                 # Template
└── package.json                 # npm workspaces
```

## Configuração inicial

### 1. Preencher o `.env` na raiz

```bash
cp .env.example .env
```

Edite o `.env`:

```env
SF_BASE_URL=https://jokr6--jokrpart.sandbox.my.salesforce.com
SF_API_VERSION=v56.0
SF_CLIENT_ID=seu_client_id
SF_CLIENT_SECRET=seu_client_secret
SF_BUYER_ID=005Ox000006DT7BIAW
PORT=3000

# ROPS — Rider Operations
ROPS_API_URL=https://api-stg.soudaki.com/icecream/api/riders/v1/deliveries
ROPS_API_KEY=sua_api_key_aqui
```

### 2. Instalar dependências

```bash
# Na raiz do monorepo — instala tudo de uma vez
npm install
```

### 3. Rodar

```bash
# Modo produção
npm run mt

# Modo desenvolvimento (hot reload)
npm run mt:dev

# Se a porta 3000 estiver ocupada:
npm run mt:3001
# ou
PORT=3001 npm run mt
# ou libere a porta:
./infra/scripts/free-port.sh
```

## Problema: porta já em uso (EADDRINUSE)

O servidor exibe a mensagem de erro e encerra limpo. Para resolver:

```bash
# Opção 1 — rodar em porta diferente
PORT=3001 npm run mt

# Opção 2 — liberar a porta 3000
./infra/scripts/free-port.sh

# Opção 3 — descobrir qual processo está usando
lsof -i :3000
```

## Problema: SF_BASE_URL não definida

O `.env` precisa estar na **raiz do monorepo** (`jokr/.env`), não dentro de `apps/management-test/`.
O servidor busca automaticamente em `../../..` relativo a `server/index.js`.

## Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/sf/ping` | Testa conectividade Salesforce |
| GET  | `/api/vendors/by-hub?hubName=SAO903&uom=ea` | Vendors por HUB |
| GET  | `/api/vendors/products?cnpj=...&uom=ea` | Produtos do vendor |
| GET  | `/api/vendors/compatible?vendorName=...&hubName=...` | Intersecção vendor × estoque |
| POST | `/api/po/create` | Cria PO + POLI + Invoice (frontend) |
| POST | `/api/po/create-full` | Fluxo automático completo |
| GET  | `/api/po/preview-key?cnpj=...` | Gera chave de acesso NF-e |
| POST | `/api/rops/deliveries` | Cria delivery na API Ice Cream (ROPS) |
