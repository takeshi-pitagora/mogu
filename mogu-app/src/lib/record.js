// =============================================================
// ③-3〜5 記録のレシート
// =============================================================
import { supabase } from './supabase';

export async function myRecordMonths() {
  const { data, error } = await supabase.rpc('my_record_months');
  if (error) throw error;
  return (data || []).map((r) => (typeof r === 'string' ? r : r.month));
}

export async function myRecord(month) {
  const { data, error } = await supabase.rpc('my_record', { p_month: month || null });
  if (error) throw error;
  return data || null;
}
