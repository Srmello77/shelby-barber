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
- Login por **nome + PIN** (PIN padrão: `1234` para todos — troque isso, veja abaixo)
- Vê a agenda do dia selecionado
- Marca atendimentos como **concluído** ou **cancelado**
- Pode **bloquear horários** (ex: almoço, folga)

## Personalizar

### Trocar a logo
Hoje o app usa uma logo placeholder em `public/assets/logo.svg` (inspirada na sua logo, mas recriada em SVG).
Para usar a imagem real:
1. Salve o arquivo da logo original como `public/assets/logo.png`
2. Nos arquivos `public/index.html` e `public/barber.html`, troque as referências de `/assets/logo.svg` para `/assets/logo.png`

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
    └── assets/logo.svg      # logo (placeholder)
```

## Limitações desta primeira versão

- Não envia SMS/WhatsApp/e-mail de confirmação automaticamente (o cliente guarda o código na hora)
- PIN dos barbeiros é simples (bom para uso interno, não é uma autenticação robusta)
- Não há tela para adicionar/remover barbeiros ou serviços pela interface — hoje isso é feito editando o código
