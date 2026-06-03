import { it, expect } from "vitest";
// @ts-ignore - mjs sem tipos
import { mapearLinhaCliente, normalizarTelefone } from "../setup/lib/mapear.mjs";

it("mapeia linha com chaves variadas e normaliza telefone", () => {
  expect(
    mapearLinhaCliente({ Nome: " Ana ", Telefone: "(85) 99999-0000" })
  ).toEqual({ nome: "Ana", telefone: "5585999990000" });
});

it("retorna null sem telefone", () => {
  expect(mapearLinhaCliente({ cliente: "Bia" })).toBeNull();
});

it("nao duplica DDI 55", () => {
  expect(normalizarTelefone("5585999990000")).toBe("5585999990000");
  expect(normalizarTelefone("85999990000")).toBe("5585999990000");
});

it("retorna null sem nome", () => {
  expect(mapearLinhaCliente({ Telefone: "85999990000" })).toBeNull();
});

it("aceita chave lowercase nome e whatsapp", () => {
  expect(
    mapearLinhaCliente({ nome: "Carlos", whatsapp: "85988887777" })
  ).toEqual({ nome: "Carlos", telefone: "5585988887777" });
});

it("aceita chave fone e NOME maiusculo", () => {
  expect(
    mapearLinhaCliente({ NOME: "Duda", fone: "11912345678" })
  ).toEqual({ nome: "Duda", telefone: "5511912345678" });
});

it("telefone com DDI 55 e 13 digitos nao duplica", () => {
  expect(normalizarTelefone("5511987654321")).toBe("5511987654321");
});

it("telefone de 10 digitos recebe DDI 55", () => {
  expect(normalizarTelefone("1133334444")).toBe("551133334444");
});
