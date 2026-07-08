# Colocar o SIGOE na internet (deploy)

O SIGOE tem um back-end em Python (Flask), então ele precisa de uma hospedagem
que rode Python — não dá para usar só GitHub Pages/Netlify (esses só servem
arquivos estáticos, sem o banco de dados).

Abaixo estão as duas opções gratuitas mais simples.

---

## Opção A — PythonAnywhere (grátis e mantém os dados) ✅ recomendada p/ escola

Vantagem: no plano gratuito o arquivo `sigoe.db` **fica salvo** (não some quando
reinicia). Você ganha um endereço tipo `https://seuusuario.pythonanywhere.com`.

1. Crie uma conta grátis em https://www.pythonanywhere.com
2. Menu **Files** → envie o projeto (ou em **Consoles → Bash**:
   `git clone <url-do-seu-repositorio>`).
3. Aba **Web** → **Add a new web app** → **Manual configuration** → Python 3.10.
4. Em **Virtualenv**, crie um e instale as dependências (no console Bash):
   ```bash
   pip install -r sigoe/backend/requirements.txt
   ```
5. Em **Web → WSGI configuration file**, aponte para o app Flask:
   ```python
   import sys
   path = '/home/SEUUSUARIO/sigoe/backend'
   if path not in sys.path:
       sys.path.append(path)
   from app import app as application
   ```
6. Clique em **Reload**. Pronto — acesse o endereço mostrado na aba Web.

---

## Opção B — Render (grátis, deploy automático pelo GitHub)

Vantagem: a cada `git push` ele publica sozinho. Desvantagem: no plano gratuito
o disco é **efêmero** — o `sigoe.db` é recriado (com os dados de exemplo) a cada
novo deploy/reinício. Bom para demonstração; para dados permanentes use disco
pago ou PostgreSQL.

1. Suba o projeto para um repositório no **GitHub**.
2. Crie conta em https://render.com e conecte o GitHub.
3. **New → Blueprint** e selecione o repositório (ele já tem o `render.yaml`).
   Ou **New → Web Service** e use:
   - Build: `pip install -r backend/requirements.txt`
   - Start: `gunicorn --chdir backend app:app --bind 0.0.0.0:$PORT`
4. Aguarde o deploy e abra a URL `https://sigoe-xxxx.onrender.com`.

---

## Aparecer no Google

Ter o site no ar já o torna acessível por qualquer link. Para ele **aparecer nas
buscas do Google**:

1. Só de estar público, o Google pode indexá-lo com o tempo.
2. Para acelerar, cadastre a URL no **Google Search Console**
   (https://search.google.com/search-console) e clique em "Solicitar indexação".
3. O sistema já tem **login real** (usuário/senha). Antes de divulgar aos
   professores: troque a senha do admin e crie uma conta para cada professor
   (veja `backend/README.md` → "Login"). Em produção, defina também a variável
   `SIGOE_SECRET`.

## Variáveis de ambiente úteis

- `PORT` — porta (as hospedagens definem automaticamente).
- `SIGOE_DB` — caminho do arquivo do banco (ex.: um disco permanente).
- `FLASK_DEBUG=0` — desliga o modo debug em produção.
