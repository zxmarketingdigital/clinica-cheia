// painel/marca-boot.js — aplica a marca do aluno assim que o HTML carrega.
// Fica separado do app.js de propósito: o app.js espera o supabase-js (CDN) e a marca
// não pode piscar com a cor padrão enquanto isso.
import { aplicarMarca } from './marca.js';

aplicarMarca(window.CLINICA_CONFIG ?? {}, document);
