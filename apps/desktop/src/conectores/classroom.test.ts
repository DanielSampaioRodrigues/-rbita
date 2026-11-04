import { describe, expect, it } from "vitest";
import { estadoDe, eventoDaTarefa, juntarTarefas, ordenarTarefas, prazoDe } from "./classroom";

describe("Classroom", () => {
  it("prazo em UTC; sem hora vale o fim do dia; sem data, sem prazo", () => {
    expect(prazoDe({ year: 2026, month: 11, day: 12 }, { hours: 2, minutes: 59 })).toBe(Date.UTC(2026, 10, 12, 2, 59));
    expect(prazoDe({ year: 2026, month: 11, day: 12 })).toBe(Date.UTC(2026, 10, 12, 23, 59));
    expect(prazoDe(undefined)).toBeNull();
  });
  it("estado da entrega", () => {
    expect(estadoDe({ courseWorkId: "a", state: "TURNED_IN" })).toBe("entregue");
    expect(estadoDe({ courseWorkId: "a", state: "RETURNED" })).toBe("devolvida");
    expect(estadoDe({ courseWorkId: "a", state: "CREATED" })).toBe("pendente");
    expect(estadoDe(undefined)).toBe("pendente");
  });
  it("junta e ordena: o que falta primeiro, pelo prazo; atrasada sem culpa só marcada", () => {
    const turma = { id: "t", nome: "Neuro", link: "https://classroom.google.com/c/t" };
    const agora = Date.UTC(2026, 10, 5);
    const l = ordenarTarefas(juntarTarefas(turma, [
      { id: "1", title: "Sem prazo" },
      { id: "2", title: "Depois", dueDate: { year: 2026, month: 11, day: 20 } },
      { id: "3", title: "Antes", dueDate: { year: 2026, month: 11, day: 1 } },
      { id: "4", title: "Feita", dueDate: { year: 2026, month: 10, day: 1 } },
      { id: "5", title: "Rascunho", state: "DRAFT" },
    ], [{ courseWorkId: "4", state: "TURNED_IN" }], agora));
    expect(l.map((x) => x.id)).toEqual(["3", "2", "1", "4"]);
    expect(l[0].atrasada).toBe(true);
    expect(l[1].atrasada).toBe(false);
    expect(l[3].estado).toBe("entregue");
    expect(l[2].link).toBe(turma.link);
  });
  it("vira compromisso de dia inteiro com o link nas notas", () => {
    const ev = eventoDaTarefa({ id: "1", turmaId: "t", turma: "Neuro", titulo: "Resenha", descricao: "", prazo: Date.UTC(2026, 10, 12, 15, 0), link: "https://classroom.google.com/x", estado: "pendente", atrasada: false })!;
    expect(ev.diaInteiro).toBe(true);
    expect(ev.titulo).toBe("Entregar: Resenha (Neuro)");
    expect(ev.notas).toContain("https://classroom.google.com/x");
    expect(new Date(ev.inicio).getHours()).toBe(0);
    expect(eventoDaTarefa({ id: "2", turmaId: "t", turma: "N", titulo: "x", descricao: "", prazo: null, link: "", estado: "pendente", atrasada: false })).toBeNull();
  });
});

import { lerCslDoZotero, resumoDoItem } from "./zotero";
describe("Zotero", () => {
  it("lê o CSL JSON (lista ou items) e tira notas e anexos", () => {
    const l = lerCslDoZotero(JSON.stringify({ items: [{ type: "book", title: "Livro", author: [{ family: "Silva" }, { family: "Souza" }], issued: { "date-parts": [[2020]] } }, { type: "note", title: "nota" }, { type: "article" }] }));
    expect(l.length).toBe(1);
    expect(resumoDoItem(l[0])).toBe("Silva et al. · 2020 · Livro");
    expect(lerCslDoZotero("[{\"type\":\"book\",\"title\":\"A\"}]").length).toBe(1);
    expect(lerCslDoZotero("não é json")).toEqual([]);
  });
});
