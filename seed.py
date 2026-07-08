"""
Dados de exemplo do SIGOE (espelha o seed que existia no js/db.js).
Insere escolas, turmas, professores, responsaveis, alunos, ocorrencias,
eventos e notificacoes no banco SQLite.
"""

import json
import random
import time
from datetime import date, timedelta


def _uid(prefix):
    return f"{prefix}_{int(time.time()*1000):x}{random.randint(0, 99999):05x}"


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def _insert(con, collections, col, rec):
    rec = dict(rec)
    rec.setdefault("id", _uid(col[:3]))
    rec.setdefault("createdAt", _now())
    rec["updatedAt"] = _now()
    fields = [f for f in (["id", "createdAt", "updatedAt"] + collections[col]) if f in rec]

    def norm(v):
        if isinstance(v, bool):
            return 1 if v else 0
        return v

    ph = ", ".join("?" for _ in fields)
    quoted = ", ".join(f'"{f}"' for f in fields)
    con.execute(f'INSERT INTO "{col}" ({quoted}) VALUES ({ph})', [norm(rec[f]) for f in fields])
    return rec


def _set_config(con, k, v):
    con.execute("INSERT INTO config (k, v) VALUES (?, ?) "
                "ON CONFLICT(k) DO UPDATE SET v = excluded.v", [k, json.dumps(v)])


def seed(con, collections):
    ano_letivo = date.today().year

    default_config = {
        "theme": "light",
        "sidebarCollapsed": False,
        "escolaAtiva": None,
        "notificacoesAtivas": True,
        "nomeInstituicao": "CETI Professor Felismino Freitas",
        "anoLetivo": ano_letivo,
    }
    for k, v in default_config.items():
        _set_config(con, k, v)

    escola = _insert(con, collections, "escolas", {
        "nome": "CETI Professor Felismino Freitas", "inep": "22012345", "municipio": "Teresina",
        "uf": "PI", "endereco": "Av. Principal, s/n - Centro", "telefone": "(86) 3221-0000",
        "diretor": "Maria de Fátima Sousa", "email": "ceti.felismino@seduc.pi.gov.br",
    })
    _set_config(con, "escolaAtiva", escola["id"])

    turmas = [_insert(con, collections, "turmas", {**t, "escolaId": escola["id"], "foto": "", "anoLetivo": ano_letivo})
              for t in [
                  {"nome": "1º Ano A", "turno": "Manhã", "serie": "1º Ano EM", "sala": "Sala 01"},
                  {"nome": "2º Ano B", "turno": "Manhã", "serie": "2º Ano EM", "sala": "Sala 05"},
                  {"nome": "3º Ano C", "turno": "Tarde", "serie": "3º Ano EM", "sala": "Sala 09"},
              ]]

    profs = [_insert(con, collections, "professores", {**p, "escolaId": escola["id"], "foto": ""})
             for p in [
                 {"nome": "Carlos Alberto Lima", "disciplina": "Matemática", "email": "carlos.lima@ceti.pi.gov.br", "telefone": "(86) 99911-0001"},
                 {"nome": "Ana Paula Ribeiro", "disciplina": "Português", "email": "ana.ribeiro@ceti.pi.gov.br", "telefone": "(86) 99911-0002"},
                 {"nome": "João Marcos Teixeira", "disciplina": "História", "email": "joao.teixeira@ceti.pi.gov.br", "telefone": "(86) 99911-0003"},
                 {"nome": "Fernanda Costa", "disciplina": "Biologia", "email": "fernanda.costa@ceti.pi.gov.br", "telefone": "(86) 99911-0004"},
             ]]

    resps = [_insert(con, collections, "responsaveis", r) for r in [
        {"nome": "José Ferreira da Silva", "parentesco": "Pai", "cpf": "111.222.333-44", "telefone": "(86) 98800-1111", "email": "jose.silva@email.com"},
        {"nome": "Marta Oliveira", "parentesco": "Mãe", "cpf": "222.333.444-55", "telefone": "(86) 98800-2222", "email": "marta.oliveira@email.com"},
        {"nome": "Antônio Gomes", "parentesco": "Responsável", "cpf": "333.444.555-66", "telefone": "(86) 98800-3333", "email": "antonio.gomes@email.com"},
    ]]

    nomes = [
        "Lucas Santos Silva", "Maria Eduarda Alves", "Pedro Henrique Costa", "Beatriz Gomes Lima",
        "Gabriel Oliveira Souza", "Larissa Ferreira", "Matheus Rocha", "Júlia Mendes Barros",
        "Rafael Nunes", "Ana Clara Dias", "Vinícius Araújo", "Sofia Cardoso",
    ]
    alunos = []
    for i, nome in enumerate(nomes):
        alunos.append(_insert(con, collections, "alunos", {
            "nome": nome,
            "turmaId": turmas[i % len(turmas)]["id"],
            "escolaId": escola["id"],
            "responsavelId": resps[i % len(resps)]["id"],
            "matricula": "2024" + str(1000 + i),
            "ra": "RA" + str(50000 + i),
            "cpf": "",
            "dataNascimento": f"{2007 + (i % 3)}-{(i % 12) + 1:02d}-{(i % 27) + 1:02d}",
            "telefone": "(86) 9" + str(90000000 + i),
            "responsavelNome": resps[i % len(resps)]["nome"],
            "foto": "",
            "sexo": "M" if i % 2 == 0 else "F",
            "status": "Ativo",
        }))

    tipos = [
        ("Atraso", "leve"), ("Uso de celular em aula", "leve"), ("Falta de material", "leve"),
        ("Indisciplina em sala", "media"), ("Desrespeito ao colega", "media"),
        ("Agressão física", "grave"), ("Dano ao patrimônio", "grave"),
    ]
    for _ in range(22):
        aluno = random.choice(alunos)
        t, g = random.choice(tipos)
        prof = random.choice(profs)
        d = date.today() - timedelta(days=random.randint(0, 60))
        _insert(con, collections, "ocorrencias", {
            "alunoId": aluno["id"], "turmaId": aluno["turmaId"], "professorId": prof["id"],
            "escolaId": escola["id"], "tipo": t, "gravidade": g,
            "descricao": f"{t} registrada durante atividade escolar. Encaminhamento realizado conforme regimento interno.",
            "data": d.isoformat(),
            "providencia": "Convocação dos responsáveis" if g == "grave" else ("Advertência verbal" if g == "media" else "Orientação"),
            "status": "Resolvida" if random.random() > 0.4 else "Em análise",
        })

    y = ano_letivo
    for ev in [
        {"titulo": "Início do ano letivo", "data": f"{y}-02-05", "tipo": "evento"},
        {"titulo": "Reunião de pais", "data": f"{y}-03-15", "tipo": "reuniao"},
        {"titulo": "Prova bimestral", "data": f"{y}-04-22", "tipo": "prova"},
        {"titulo": "Feriado - Tiradentes", "data": f"{y}-04-21", "tipo": "feriado"},
        {"titulo": "Conselho de classe", "data": f"{y}-06-28", "tipo": "reuniao"},
        {"titulo": "Festa Junina", "data": f"{y}-06-24", "tipo": "evento"},
    ]:
        _insert(con, collections, "eventos", ev)

    _insert(con, collections, "notificacoes", {"titulo": "Bem-vindo ao SIGOE", "mensagem": "Sistema iniciado com dados de demonstração.", "tipo": "info", "icon": "fa-hand-sparkles", "lida": False})
    _insert(con, collections, "notificacoes", {"titulo": "Ocorrência grave registrada", "mensagem": "Uma ocorrência de gravidade alta requer atenção.", "tipo": "warn", "icon": "fa-triangle-exclamation", "lida": False})
