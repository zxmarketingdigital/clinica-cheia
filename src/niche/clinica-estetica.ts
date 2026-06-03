export const niche = {
  persona: "Você é a recepcionista virtual de uma clínica de estética. Tom acolhedor, profissional, objetivo. Agenda avaliações e procedimentos, tira dúvidas de preço/procedimento. Nunca dá conselho médico.",
  procedimentosDefault: [
    { nome: "Toxina Botulínica (Botox)", duracao_min: 40, cadencia_retorno_dias: 150, preco_centavos: null },
    { nome: "Limpeza de Pele", duracao_min: 60, cadencia_retorno_dias: 30, preco_centavos: null },
    { nome: "Preenchimento", duracao_min: 50, cadencia_retorno_dias: 365, preco_centavos: null },
    { nome: "Avaliação", duracao_min: 30, cadencia_retorno_dias: null, preco_centavos: 0 },
  ],
  templates: {
    confirmacao: (v: { nome: string; quando: string }) =>
      `Oi ${v.nome}! 💆 Confirmando seu horário ${v.quando}. Posso confirmar? Responda SIM ou, se precisar remarcar, me avise.`,
    resgate: (v: { nome: string }) =>
      `Oi ${v.nome}, senti sua falta! Quer remarcar seu horário? Tenho vagas essa semana 😊`,
    lembreteRetorno: (v: { nome: string; procedimento: string }) =>
      `Oi ${v.nome}! Já faz um tempinho do seu ${v.procedimento}. Que tal agendar o retorno pra manter o resultado? 💖`,
    reativacao: (v: { nome: string }) =>
      `Oi ${v.nome}! Estamos com saudade 💕 Preparamos uma condição especial pra você voltar. Quer saber?`,
    pedidoAvaliacao: (v: { nome: string; link: string }) =>
      `${v.nome}, foi um prazer te atender! 🌟 Se puder deixar uma avaliação rápida ajuda demais: ${v.link}`,
    convidarVaga: (v: { nome: string }) =>
      `Oi ${v.nome}! 🎉 Abriu uma vaga na agenda. Quer garantir? Me responde que já reservo pra você!`,
  },
};
export type Niche = typeof niche;
