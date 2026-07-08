# SIGOE — Sistema Inteligente de Gestão de Ocorrências Escolares

Sistema web para o **CETI Professor Felismino Freitas** (SEDUC-PI), com front-end
em **HTML5, CSS3 e JavaScript puro** (sem frameworks) e um back-end em **Flask +
SQLite**. Funciona como uma **SPA** (Single Page Application) e agora armazena os
dados em um **banco de dados compartilhado** (`backend/sigoe.db`).

> **Etapa 3 (banco de dados) implementada.** O front chama uma API REST em `/api`
> e os dados ficam no SQLite. Se o servidor não estiver rodando, o app volta
> automaticamente ao modo local (localStorage), então nunca "quebra".
> O acesso tem **login real** (usuário/senha com hash). Usuário inicial:
> `admin` / `sigoe2026` (troque depois — veja `backend/README.md`).

## Como executar

### Com banco de dados (recomendado — Etapa 3)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
# acesse http://localhost:5000
```

O servidor Flask serve o front-end **e** a API, e cria o arquivo `backend/sigoe.db`
com dados de exemplo na primeira execução. Veja `backend/README.md` para detalhes.

### Sem banco (só a interface, modo local)

```bash
python3 -m http.server 8080
# acesse http://localhost:8080 (dados ficam só no navegador)
```

## Funcionalidades

- Dashboard com cartões de estatística e gráficos (Chart.js)
- Cadastro de **escolas, turmas (com foto), alunos, professores e responsáveis**
- **Registro de ocorrências** com gravidade, status e anexos
- **Histórico completo** e **linha do tempo** por aluno
- **Pesquisa instantânea** global e **filtros** (turma, professor, gravidade, período)
- **Exportação PDF** (jsPDF) e **Excel** (SheetJS) + **impressão** de relatórios
- **Calendário escolar** e **galeria de fotos** das turmas
- **Notificações** na interface
- **Tema claro/escuro** e **menu lateral retrátil**
- **Backup e restauração** dos dados em arquivo JSON
- Design responsivo, institucional (azul, branco e vermelho)

## Estrutura

```
index.html            SPA (shell + login visual)
css/style.css         estilos globais, tema, componentes
css/dashboard.css     dashboard, gráficos, widgets
js/utils.js           helpers, toasts, modais, validações
js/db.js              camada de dados (API REST + cache, com fallback localStorage)
backend/app.py        servidor Flask: API REST /api + serve o front
backend/seed.py       dados de exemplo (seed) do banco
backend/requirements.txt  dependências Python (Flask, Flask-Cors)
backend/sigoe.db      banco SQLite (criado automaticamente)
js/app.js             roteador SPA, sidebar, tema, header
js/dashboard.js       dashboard + gráficos
js/escolas.js         cadastro de escolas
js/turmas.js          cadastro de turmas (com foto)
js/alunos.js          cadastro + histórico de alunos
js/professores.js     cadastro de professores
js/responsaveis.js    cadastro de responsáveis
js/ocorrencias.js     registro/filtros de ocorrências
js/relatorios.js      exportação PDF/Excel + impressão
js/calendario.js      calendário escolar
js/galeria.js         galeria de fotos das turmas
js/configuracoes.js   preferências + backup/restauração
```

## Bibliotecas (via CDN)

- [Chart.js](https://www.chartjs.org/) — gráficos
- [jsPDF](https://github.com/parallax/jsPDF) + AutoTable — PDF
- [SheetJS (xlsx)](https://sheetjs.com/) — Excel
- [Font Awesome](https://fontawesome.com/) — ícones

## Banco de dados

Cada coleção vira uma tabela no SQLite: `escolas, turmas, alunos, professores,
responsaveis, ocorrencias, eventos, notificacoes`, além de `config`. A API expõe:

| Método | Rota                     | Ação                              |
|--------|--------------------------|-----------------------------------|
| POST   | `/api/login`             | autentica (usuário/senha)         |
| POST   | `/api/logout`            | encerra a sessão                  |
| GET    | `/api/me`                | usuário logado (ou 401)           |
| GET    | `/api/state`             | carrega todo o banco (semeia se vazio) |
| POST   | `/api/<colecao>`         | cria um registro                  |
| PUT    | `/api/<colecao>/<id>`    | atualiza um registro              |
| DELETE | `/api/<colecao>/<id>`    | remove um registro                |
| PUT    | `/api/config`            | salva preferências                |
| POST   | `/api/reset`             | apaga tudo e recria os exemplos   |
| POST   | `/api/import`            | restaura um backup JSON           |

## Próximas etapas

- Autenticação real (login seguro com usuários no banco) e controle de acesso.
- Hospedagem do backend (ex.: Render, Railway, PythonAnywhere) com um banco maior
  (PostgreSQL/MySQL) se o volume crescer.
