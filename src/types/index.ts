export interface Anuncio {
  idAnuncio: string;
  anunciante: string;
  tituloOferta: string;
  texto: string;
  textoCompleto: string;
  midias: { url: string; tipo: string }[];
  dataInicioISO: string | null;
  dataFimISO: string | null;
  dataUltimaAtualizacaoISO: string | null;
  plataformas: string[];
  urlDestino: string;
  urlBiblioteca: string;
  cta: string;
  adActiveStatus: string;
  statusTexto: string;
  ativo: boolean;
  diasAtivo: number;
  spendMax: number;
  impressionsMax: number;
  audienceMax: number;
  variacoesAtivasEstimadas: number;
  variacoesAtivas: number;
  consistenciaTemporal: number;
  engajamentoEstimado: number;
  scoreEscala: number;
  statusEscala: string;
  evergreen: boolean;
  entregavel: string;
  destino: string;
  origem: string;
  gastoDiarioEstimado?: number;
  alcanceDiarioEstimado?: number;
  custoPorMil?: number;
}

export interface CloneJob {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  output?: string;
  error?: string;
  createdAt: string;
  options: CloneOptions;
}

export interface CloneOptions {
  includeExternal: boolean;
  respectRobots: boolean;
  flat: boolean;
  rescueMode: boolean;
  concurrency: number;
  timeout: number;
  renderWait: number;
}

export interface User {
  email: string;
  nome: string;
  plano: 'Free' | 'Pro' | 'Enterprise';
}

export interface FilterState {
  ordenacao: string;
  plataforma: string;
  pais: string;
  statusApi: string;
  midia: string;
  scoreMin: number;
  diasMin: number;
  destino: string;
  entregavel: string;
  segmento: string;
  palavrasNegativas: string;
}
