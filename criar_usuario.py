"""
Cria (ou atualiza a senha de) um usuario do SIGOE.

Uso:
    python criar_usuario.py <usuario> <senha> ["Nome Completo"] [email] [papel]

Exemplos:
    python criar_usuario.py prof.ana Senha@123 "Ana Paula Ribeiro" ana@escola.pi.gov.br professor
    python criar_usuario.py admin NovaSenha123        # troca a senha do admin
"""

import sqlite3
import sys
import time

from werkzeug.security import generate_password_hash

from app import DB_PATH, init_schema


def criar(usuario, senha, nome=None, email="", papel="professor"):
    init_schema()  # garante que a tabela existe
    con = sqlite3.connect(DB_PATH)
    existente = con.execute("SELECT id FROM usuarios WHERE usuario = ?", [usuario]).fetchone()
    senha_hash = generate_password_hash(senha)
    if existente:
        con.execute("UPDATE usuarios SET senha_hash = ?, nome = COALESCE(?, nome), "
                    "email = COALESCE(NULLIF(?, ''), email), papel = ? WHERE usuario = ?",
                    [senha_hash, nome, email, papel, usuario])
        acao = "atualizado"
    else:
        con.execute("INSERT INTO usuarios (id, nome, email, usuario, senha_hash, papel, createdAt) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [f"usr_{int(time.time()*1000):x}", nome or usuario, email, usuario,
                     senha_hash, papel, time.strftime("%Y-%m-%dT%H:%M:%S")])
        acao = "criado"
    con.commit()
    con.close()
    print(f"Usuario '{usuario}' {acao} com sucesso.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    args = sys.argv[1:]
    criar(
        usuario=args[0],
        senha=args[1],
        nome=args[2] if len(args) > 2 else None,
        email=args[3] if len(args) > 3 else "",
        papel=args[4] if len(args) > 4 else "professor",
    )
