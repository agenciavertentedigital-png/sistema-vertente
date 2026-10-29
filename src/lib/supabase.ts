import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Sem as variáveis de ambiente o sistema roda em "modo demonstração":
 * sem login e com a base de clientes local (usado na prévia publicada no Claude).
 */
export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null;
export const modoDemonstracao = supabase === null;

/** Endereço oficial do sistema (links enviados para clientes usam sempre este). */
export const SISTEMA_URL = "https://sistema.agenciavertente.com.br";
