# Shelby Barber — App de Agendamento

Aplicativo web para clientes agendarem horário na Shelby Barber, com painel para o barbeiro gerenciar a agenda.

## ⚠️ Importante: onde rodar o projeto

Este projeto está instalado em `C:\Users\financeiro2\ShelbyBarber` (disco local), **não** dentro do Google Drive.
O Google Drive trava arquivos durante a instalação de pacotes (`npm install`), o que causa erros. Uma cópia do
código-fonte também fica salva em `02 Projetos\ShelbyBarber` no seu Drive como backup, mas para **rodar** o app,
sempre use a pasta local.

Se você editar os arquivos, lembre-se de copiar as mudanças para as duas pastas (ou me avise para eu fazer isso).

## Como rodar

Abra um terminal na pasta do projeto e rode:

```bash
npm install
npm start
```

O terminal vai mostrar:

```
Shelby Barber rodando em http://localhost:3000
```

- **Agendamento do cliente:** http://localhost:3000
- **Painel do barbeiro:** http://localhost:3000/barber.html

Para parar o servidor, feche o terminal ou pressione `Ctrl + C`.

## Como funciona

### Cliente
1. Escolhe o serviço (com duração e preço)
2. Escolhe o barbeiro
3. Escolhe a data
4. Vê os horários realmente disponíveis (já considera agendamentos e bloqueios existentes)
5. Preenche nome e telefone e confirma
6. Recebe um **código de 6 dígitos** — pode usá-lo depois na própria página para consultar ou cancelar o agendamento

### Barbeiro
- Login por **nome + PIN** (PIN padrão: `1234` — troque isso, veja abaixo)
- Vê a agenda do dia selecionado
- Marca atendimentos como **concluído** ou **cancelado**
- Pode **bloquear horários** (ex: almoço, folga)

## Colocar o app online (deploy)

Enquanto o app só roda em `localhost`, ninguém fora do seu computador consegue acessá-lo. Para o barbeiro usar
na loja e os clientes dele agendarem pelo celular, o app precisa estar hospedado num serviço na nuvem.

Recomendação: **Railway** (https://railway.com). É simples de configurar, funciona bem com Node.js + SQLite
(desde que se use um volume persistente, veja abaixo) e tem um plano de entrada barato.

### Passo a passo

1. **Criar um repositório no GitHub** e subir o código deste projeto para lá (o projeto já está preparado com
   `git init` e o primeiro commit feito — falta só criar o repositório vazio no GitHub e rodar):
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/shelby-barber.git
   git branch -M main
   git push -u origin main
   ```
2. Crie uma conta na Railway (pode entrar direto com sua conta do GitHub)
3. No painel da Railway, clique em **New Project → Deploy from GitHub repo** e escolha o repositório `shelby-barber`
4. A Railway detecta automaticamente que é um projeto Node.js (lê o `package.json`) e já roda `npm install` + `npm start`
5. **Adicione um volume persistente** (essencial — sem isso, o banco de dados é apagado a cada novo deploy):
   - Na aba do serviço, vá em **Settings → Volumes → New Volume**
   - Monte o volume no caminho `/data`
6. **Configure a variável de ambiente** `DB_PATH` apontando para dentro do volume:
   - Aba **Variables** → adicionar `DB_PATH` = `/data/shelby.sqlite`
7. Clique em **Deploy**. Quando terminar, a Railway mostra uma URL pública (algo como
   `https://shelby-barber-production.up.railway.app`) — essa é a URL que você compartilha com o barbeiro e os clientes
8. (Opcional) Em **Settings → Domains**, dá para ligar um domínio próprio (ex: `agendar.shelbybarber.com.br`) a essa URL

Depois do primeiro deploy, qualquer novo `git push` para o repositório atualiza o app automaticamente.

⚠️ O PIN padrão do barbeiro é `1234` — depois do deploy, troque isso direto no banco de produção antes de divulgar a URL.

### Barbeiros e PINs
Edite a tabela `barbers` no banco (`server/db/shelby.sqlite`) ou apague o arquivo do banco e ajuste os valores
iniciais em `server/db.js` (seção `insertBarber.run(...)`) antes de rodar `npm start` novamente — isso recria o banco do zero.

### Serviços e preços
Mesma ideia: ajuste `insertService.run('Nome', duracaoMin, precoEmCentavos)` em `server/db.js`.

### Horário de funcionamento
Edite `server/config.js` (`SHOP_HOURS`) — dias fechados usam `null`, dias abertos usam `{ open: 'HH:MM', close: 'HH:MM' }`.

⚠️ Se você já rodou o app antes, o banco (`server/db/shelby.sqlite`) já existe e os valores de seed em `db.js`
**não** serão reaplicados automaticamente. Para resetar tudo, apague a pasta `server/db` e rode `npm start` de novo.

## Estrutura do projeto

```
ShelbyBarber/
├── server/
│   ├── index.js        # servidor Express + API
│   ├── db.js            # banco SQLite (schema + dados iniciais)
│   ├── config.js         # horário de funcionamento
│   ├── availability.js    # cálculo de horários disponíveis
│   └── db/shelby.sqlite   # arquivo do banco (criado automaticamente)
└── public/
    ├── index.html        # página do cliente
    ├── barber.html         # painel do barbeiro
    ├── css/style.css
    ├── js/app.js           # lógica da página do cliente
    ├── js/barber.js         # lógica do painel do barbeiro
    └── assets/logo.png      # logo da Shelby Barber
```

`DB_PATH` (variável de ambiente) define onde o arquivo do banco fica salvo — em produção (Railway) deve apontar
para dentro do volume persistente (`/data/shelby.sqlite`); localmente, se não for definida, usa `server/db/shelby.sqlite`.

## Limitações desta primeira versão

- Não envia SMS/WhatsApp/e-mail de confirmação automaticamente (o cliente guarda o código na hora)
- PIN dos barbeiros é simples (bom para uso interno, não é uma autenticação robusta)
- Não há tela para adicionar/remover barbeiros ou serviços pela interface — hoje isso é feito editando o código
