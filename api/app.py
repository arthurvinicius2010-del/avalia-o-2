"""
SIGOE - backend (Etapa 3)
=========================
API REST em Flask com banco de dados SQLite (arquivo `sigoe.db`).

- Serve o front-end (index.html, css/, js/, assets/) que fica na pasta acima.
- Expoe uma API sob /api para ler/gravar os dados (mesmas colecoes do db.js:
  escolas, turmas, alunos, professores, responsaveis, ocorrencias, eventos,
  notificacoes) alem das configuracoes.
- Os dados agora ficam em UM banco compartilhado (sigoe.db), e nao mais
  isolados no navegador de cada pessoa.

Como rodar:
    cd backend
    python -m venv .venv
    # Windows:  .venv\\Scripts\\activate
    # Linux/Mac: source .venv/bin/activate
    pip install -r requirements.txt
    python app.py
    # abra http://localhost:5000
"""

import json
import os
import sqlite3
import time
from functools import wraps

from flask import Flask, g, jsonify, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

# ----------------------------------------------------------------------------
# Caminhos
# ----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))      # .../sigoe/backend
FRONT_DIR = os.path.dirname(BASE_DIR)                        # .../sigoe
DB_PATH = os.environ.get("SIGOE_DB", os.path.join(BASE_DIR, "sigoe.db"))

# ----------------------------------------------------------------------------
# Modelo de dados: cada colecao vira uma tabela.
# Todas tem id/createdAt/updatedAt + as colunas abaixo.
# ----------------------------------------------------------------------------
COLLECTIONS = {
    "escolas": ["nome", "inep", "municipio", "uf", "endereco", "telefone", "diretor", "email"],
    "turmas": ["nome", "turno", "serie", "sala", "escolaId", "foto", "anoLetivo"],
    "alunos": ["nome", "turmaId", "escolaId", "responsavelId", "matricula", "ra", "cpf",
               "dataNascimento", "telefone", "responsavelNome", "foto", "sexo", "status"],
    "professores": ["nome", "disciplina", "email", "telefone", "cpf", "escolaId", "foto"],
    "responsaveis": ["nome", "parentesco", "cpf", "telefone", "email", "endereco"],
    "ocorrencias": ["alunoId", "turmaId", "professorId", "escolaId", "tipo", "gravidade",
                    "descricao", "data", "providencia", "status", "anexo"],
    "eventos": ["titulo", "data", "tipo"],
    "notificacoes": ["titulo", "mensagem", "tipo", "icon", "lida"],
}

BASE_COLS = ["id", "createdAt", "updatedAt"]

app = Flask(__name__, static_folder=None)
# Chave usada para assinar os cookies de sessao (login). Em producao defina
# a variavel de ambiente SIGOE_SECRET com um valor secreto proprio.
app.secret_key = os.environ.get("SIGOE_SECRET", "sigoe-dev-secret-troque-em-producao")
CORS(app, supports_credentials=True)

# Usuario administrador criado na primeira execucao (troque a senha depois!).
ADMIN_DEFAULT = {"nome": "Administrador", "email": "admin@ceti.pi.gov.br",
                 "usuario": "admin", "senha": "sigoe2026", "papel": "admin"}


# ----------------------------------------------------------------------------
# Conexao / criacao das tabelas
# ----------------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_schema():
    con = sqlite3.connect(DB_PATH)
    for col, fields in COLLECTIONS.items():
        cols = ["id TEXT PRIMARY KEY", "createdAt TEXT", "updatedAt TEXT"]
        cols += [f'"{f}" TEXT' for f in fields]
        con.execute(f'CREATE TABLE IF NOT EXISTS "{col}" ({", ".join(cols)})')
    con.execute('CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT)')
    con.execute('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)')
    con.execute(
        'CREATE TABLE IF NOT EXISTS usuarios ('
        'id TEXT PRIMARY KEY, nome TEXT, email TEXT, usuario TEXT UNIQUE, '
        'senha_hash TEXT, papel TEXT, createdAt TEXT)'
    )
    con.commit()
    con.close()
    ensure_admin()


def ensure_admin():
    """Cria o usuario admin padrao se ainda nao existir nenhum usuario."""
    con = sqlite3.connect(DB_PATH)
    total = con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if total == 0:
        con.execute(
            "INSERT INTO usuarios (id, nome, email, usuario, senha_hash, papel, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            [f"usr_{int(time.time()*1000):x}", ADMIN_DEFAULT["nome"], ADMIN_DEFAULT["email"],
             ADMIN_DEFAULT["usuario"], generate_password_hash(ADMIN_DEFAULT["senha"]),
             ADMIN_DEFAULT["papel"], time.strftime("%Y-%m-%dT%H:%M:%S")]
        )
        con.commit()
    con.close()


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("uid"):
            return jsonify({"error": "nao autenticado"}), 401
        return fn(*args, **kwargs)
    return wrapper


def row_to_dict(col, row):
    allowed = BASE_COLS + COLLECTIONS[col]
    return {k: row[k] for k in allowed if k in row.keys()}


# ----------------------------------------------------------------------------
# Rotas da API
# ----------------------------------------------------------------------------
@app.get("/api/state")
@login_required
def get_state():
    """Retorna todo o banco. Popula com dados de exemplo na primeira vez."""
    seed_if_empty()
    db = get_db()
    collections = {}
    for col in COLLECTIONS:
        rows = db.execute(f'SELECT * FROM "{col}"').fetchall()
        collections[col] = [row_to_dict(col, r) for r in rows]
    cfg_rows = db.execute("SELECT k, v FROM config").fetchall()
    config = {r["k"]: json.loads(r["v"]) for r in cfg_rows}
    return jsonify({"config": config, "collections": collections})


@app.post("/api/<col>")
@login_required
def create_record(col):
    if col not in COLLECTIONS:
        return jsonify({"error": "colecao invalida"}), 404
    data = request.get_json(force=True) or {}
    db = get_db()
    _insert(db, col, data)
    db.commit()
    return jsonify(data), 201


@app.put("/api/<col>/<rid>")
@login_required
def update_record(col, rid):
    if col not in COLLECTIONS:
        return jsonify({"error": "colecao invalida"}), 404
    patch = request.get_json(force=True) or {}
    db = get_db()
    fields = [f for f in (BASE_COLS + COLLECTIONS[col]) if f in patch and f != "id"]
    if fields:
        sets = ", ".join(f'"{f}" = ?' for f in fields)
        db.execute(f'UPDATE "{col}" SET {sets} WHERE id = ?',
                   [_norm(patch[f]) for f in fields] + [rid])
        db.commit()
    return jsonify({"ok": True})


@app.delete("/api/<col>/<rid>")
@login_required
def delete_record(col, rid):
    if col not in COLLECTIONS:
        return jsonify({"error": "colecao invalida"}), 404
    db = get_db()
    db.execute(f'DELETE FROM "{col}" WHERE id = ?', [rid])
    db.commit()
    return jsonify({"ok": True})


@app.put("/api/config")
@login_required
def set_config():
    data = request.get_json(force=True) or {}
    db = get_db()
    for k, v in data.items():
        db.execute("INSERT INTO config (k, v) VALUES (?, ?) "
                   "ON CONFLICT(k) DO UPDATE SET v = excluded.v", [k, json.dumps(v)])
    db.commit()
    return jsonify({"ok": True})


@app.post("/api/reset")
@login_required
def reset():
    db = get_db()
    for col in COLLECTIONS:
        db.execute(f'DELETE FROM "{col}"')
    db.execute("DELETE FROM config")
    db.execute("DELETE FROM meta")
    db.commit()
    seed_if_empty()
    return jsonify({"ok": True})


@app.post("/api/import")
@login_required
def import_data():
    """Restaura um backup JSON (mesmo formato do exportado pelo front)."""
    payload = request.get_json(force=True) or {}
    data = payload.get("data", payload)
    db = get_db()
    for col in COLLECTIONS:
        db.execute(f'DELETE FROM "{col}"')
        for rec in data.get(col, []) or []:
            _insert(db, col, rec)
    db.execute("DELETE FROM config")
    for k, v in (data.get("config") or {}).items():
        db.execute("INSERT INTO config (k, v) VALUES (?, ?)", [k, json.dumps(v)])
    db.commit()
    return jsonify({"ok": True})


# ----------------------------------------------------------------------------
# Autenticacao (login real)
# ----------------------------------------------------------------------------
def _user_public(row):
    return {"id": row["id"], "nome": row["nome"], "email": row["email"],
            "usuario": row["usuario"], "papel": row["papel"]}


@app.post("/api/login")
def login():
    data = request.get_json(force=True) or {}
    ident = (data.get("usuario") or data.get("email") or "").strip()
    senha = data.get("senha") or ""
    db = get_db()
    row = db.execute("SELECT * FROM usuarios WHERE usuario = ? OR email = ?",
                     [ident, ident]).fetchone()
    if not row or not check_password_hash(row["senha_hash"], senha):
        return jsonify({"error": "Usuario ou senha invalidos"}), 401
    session["uid"] = row["id"]
    session.permanent = True
    return jsonify({"user": _user_public(row)})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    uid = session.get("uid")
    if not uid:
        return jsonify({"user": None}), 401
    db = get_db()
    row = db.execute("SELECT * FROM usuarios WHERE id = ?", [uid]).fetchone()
    if not row:
        session.clear()
        return jsonify({"user": None}), 401
    return jsonify({"user": _user_public(row)})


# ----------------------------------------------------------------------------
# Helpers de escrita
# ----------------------------------------------------------------------------
def _norm(v):
    """Converte valores para algo que o SQLite guarda bem."""
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (dict, list)):
        return json.dumps(v)
    return v


def _insert(db, col, rec):
    fields = [f for f in (BASE_COLS + COLLECTIONS[col]) if f in rec]
    placeholders = ", ".join("?" for _ in fields)
    quoted = ", ".join(f'"{f}"' for f in fields)
    db.execute(f'INSERT OR REPLACE INTO "{col}" ({quoted}) VALUES ({placeholders})',
               [_norm(rec[f]) for f in fields])


# ----------------------------------------------------------------------------
# Serve o front-end
# ----------------------------------------------------------------------------
@app.get("/")
def index():
    return send_from_directory(FRONT_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path):
    # Nao intercepta /api (tratado acima). Serve arquivos do front.
    full = os.path.join(FRONT_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(FRONT_DIR, path)
    return send_from_directory(FRONT_DIR, "index.html")


# ----------------------------------------------------------------------------
# Dados de exemplo (seed) — espelha o antigo db.js
# ----------------------------------------------------------------------------
def seed_if_empty():
    from seed import seed
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    already = con.execute("SELECT v FROM meta WHERE k = 'seeded'").fetchone()
    if already:
        con.close()
        return
    seed(con, COLLECTIONS)
    con.execute("INSERT INTO meta (k, v) VALUES ('seeded', '1')")
    con.commit()
    con.close()


# Garante que as tabelas existem assim que o modulo carrega.
init_schema()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
