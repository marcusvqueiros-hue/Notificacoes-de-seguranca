export interface Notificacao {
  id: string
  notificacao: number | null
  data: string // YYYY-MM-DD
  inspetor: string
  equipe: string
  base: string
  gerencia: string
  naoConformidade: string
  qnt: number
  pnt: number
  valor: number
  tratado: boolean
  dias: number | null
  inspecao: number | null
  coordenador: string
  processo: string
  status: string
  eletricistas: string[]
}

export type NotificacaoInput = Omit<Notificacao, 'id'> & { id?: string }

export interface Session {
  token: string
  username: string
  nome: string
  role: 'admin' | 'viewer'
  /** senha provisória: precisa ser trocada antes de acessar os dados */
  mustChange?: boolean
}

export type FilterKey =
  | 'mes'
  | 'ano'
  | 'base'
  | 'gerencia'
  | 'processo'
  | 'coordenador'
  | 'inspetor'
  | 'equipe'
  | 'tratado'
  | 'status'
  | 'naoConformidade'
  | 'colaborador'

export type Filters = Record<FilterKey, string[]>

export const EMPTY_FILTERS: Filters = {
  mes: [],
  ano: [],
  base: [],
  gerencia: [],
  processo: [],
  coordenador: [],
  inspetor: [],
  equipe: [],
  tratado: [],
  status: [],
  naoConformidade: [],
  colaborador: [],
}

export interface AppUser {
  username: string
  nome: string
  role: 'admin' | 'viewer'
  chapa: number | null
  funcao: string
  base: string
  processo: string
  gerencia: string
  ativo: boolean
}

export type AppUserInput = Omit<AppUser, 'ativo'> & { ativo?: boolean; senha?: string }
