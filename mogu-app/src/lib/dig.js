// =============================================================
// dig（引き渡し書 §6-4）。もらったいいねの累計で上がる。dig n に 5×n×(n−1)
// =============================================================
import { supabase } from './supabase';

export const digAt = (n) => 5 * Math.max(n, 1) * (Math.max(n, 1) - 1);

export async function myDig() {
  const { data, error } = await supabase.rpc('my_dig');
  if (error) throw error;
  return data || { dig: 1, likes: 0, at: 0, next_at: 10, pending_from: null };
}

export async function markDigShown() {
  const { error } = await supabase.rpc('mark_dig_shown');
  if (error) throw error;
}

export async function userFoundShops(userId) {
  const { data, error } = await supabase.rpc('user_found_shops', { p_user: userId });
  if (error) throw error;
  return data || [];
}

export async function userDig(userId) {
  const { data, error } = await supabase.rpc('user_dig', { p_user: userId });
  if (error) throw error;
  return data || { dig: 1, found: 0 };
}
