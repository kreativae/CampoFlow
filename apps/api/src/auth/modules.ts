// Módulos ("páginas") que o gestor pode liberar por membro. Chave canônica usada
// tanto no allowlist da Membership quanto no mapeamento de rotas do guard.
export const MODULE_KEYS = [
  'rebanho',
  'pastagens',
  'reproducao',
  'insumos',
  'maquinas',
  'equipe',
  'agenda',
  'mapa',
  'safras',
  'documentos',
  'contatos',
  'financeiro',
  'relatorios',
  'inteligencia',
  'notificacoes',
  'membros',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

// Mapeia o primeiro segmento de rota depois de /fazendas/:farmId/ para um módulo.
// Segmentos ausentes deste mapa (ex.: 'painel') não são restringidos.
const SEGMENT_TO_MODULE: Record<string, ModuleKey> = {
  animais: 'rebanho',
  sanidade: 'rebanho',
  pastagens: 'pastagens',
  reproducao: 'reproducao',
  insumos: 'insumos',
  maquinas: 'maquinas',
  funcionarios: 'equipe',
  agenda: 'agenda',
  'elementos-mapa': 'mapa',
  'analises-solo': 'mapa',
  clima: 'mapa',
  safras: 'safras',
  documentos: 'documentos',
  contatos: 'contatos',
  lancamentos: 'financeiro',
  financeiro: 'financeiro',
  relatorios: 'relatorios',
  inteligencia: 'inteligencia',
  notificacoes: 'notificacoes',
  membros: 'membros',
  convites: 'membros',
};

export function moduleForSegment(segment: string): ModuleKey | null {
  return SEGMENT_TO_MODULE[segment] ?? null;
}
