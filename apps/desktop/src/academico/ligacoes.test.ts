import { describe, expect, it } from "vitest";
import type { Atividade, Materia } from "../api";
import { diasAntes, eventoDaAtividade, materiaDaTurma } from "./ligacoes";

const a: Atividade = { id: "1", materiaId: "m", tipo: "prova", titulo: "P1", data: "2026-11-20", peso: null, nota: null, feita: false, criadoEm: 0 };

describe("Estudos ligados à Agenda e ao Classroom", () => {
  it("dias antes, atravessando o mês", () => {
    expect(diasAntes("2026-11-20", 3)).toBe("2026-11-17");
    expect(diasAntes("2026-12-02", 5)).toBe("2026-11-27");
    expect(diasAntes("", 3)).toBe("");
  });
  it("compromisso da prova e do dia de começar", () => {
    const p = eventoDaAtividade(a, "Prova", "Neuro", "prazo")!;
    expect(p.titulo).toBe("Prova: P1 (Neuro)");
    expect(p.diaInteiro).toBe(true);
    expect(new Date(p.inicio).getDate()).toBe(20);
    const c = eventoDaAtividade(a, "Prova", "Neuro", "comecar", 3)!;
    expect(c.titulo).toBe("Começar: P1 (Neuro)");
    expect(new Date(c.inicio).getDate()).toBe(17);
    expect(c.notas).toContain("20/11/2026");
    expect(eventoDaAtividade(a, "Prova", "", "comecar", 0)).toBeNull();
    expect(eventoDaAtividade({ ...a, data: "" }, "Prova", "", "prazo")).toBeNull();
  });
  it("acha a matéria da turma pelo nome, sem acento", () => {
    const ms: Materia[] = [{ id: "1", nome: "Neuropsicologia", professor: "", cor: "mar", criadoEm: 0 }, { id: "2", nome: "Psicologia do Desenvolvimento", professor: "", cor: "mar", criadoEm: 0 }];
    expect(materiaDaTurma("NEUROPSICOLOGIA · Turma A", ms)?.id).toBe("1");
    expect(materiaDaTurma("Psicologia do Desenvolvimento II", ms)?.id).toBe("2");
    expect(materiaDaTurma("Estatística", ms)).toBeNull();
  });
});
