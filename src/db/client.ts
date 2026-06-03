import { createClient } from "@supabase/supabase-js";
export const makeDb = (url: string, key: string) => createClient(url, key, { auth: { persistSession: false } });
