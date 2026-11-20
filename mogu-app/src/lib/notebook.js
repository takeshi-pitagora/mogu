// =============================================================
// ㉖ 探検手帳（モグコイン・dig・番付）
//   コインの数を見るのはここだけ（引き渡し書 ㉖）
// =============================================================
import { supabase } from './supabase';

const rpc = async (name, args) => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
};

export const myNotebook = () => rpc('my_notebook');
export const myCoinLog = (limit = 120) => rpc('my_coin_log', { p_limit: limit }).then((r) => r || []);
export const myCoinMonths = () => rpc('my_coin_months').then((r) => r || []);
export const coinRank = (scope) => rpc('coin_rank', { p_scope: scope }).then((r) => r || []);
export const myLikes = () => rpc('my_likes');
export const myFound = () => rpc('my_found').then((r) => r || []);
export const setRankVisible = (on) => rpc('set_rank_visible', { p_on: on });

// ［記録］の行の言い方（引き渡し書 §6-2 のコインの表と同じ並び）
export const ACTION_LABEL = {
  register: 'お店を見つけて登録',
  register_full: 'しっかり登録',
  photo: '写真を足す',
  comment: 'ひとこと',
  tag: 'ハッシュタグを付ける',
  menu: 'メニューを足す',
  field: '情報を足す',
  confirm: '情報の確認',
  edit_accepted: '修正依頼がとおった',
  saved_bonus: '見つけたお店が10人に保存された',
  visit_stamp: '行った！',
};
export const actionLabel = (a, n) => {
  const base = ACTION_LABEL[a] || a;
  return n > 1 && (a === 'photo' || a === 'tag' || a === 'menu') ? `${base}（${n}枚）` : base;
};

// 「11.9」と曜日
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
export const dayLabel = (iso) => { const [, m, d] = String(iso).split('-'); return `${Number(m)}.${Number(d)}`; };
export const weekLabel = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return WEEK[new Date(y, m - 1, d).getDay()];
};
export const monthLabel = (iso) => `${Number(String(iso).split('-')[1])}月`;
