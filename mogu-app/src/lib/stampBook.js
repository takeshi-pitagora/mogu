// =============================================================
// ③ スタンプ帳（確定版 Final-03-StampBook）
//   ㉒の来店スタンプを、行った順に9マスの台紙にためる。自分だけが見られる。
// =============================================================
import { supabase } from './supabase';

export const PER_SHEET = 9;

export async function myStamps() {
  const { data, error } = await supabase.rpc('my_stamps');
  if (error) throw error;
  return data || [];
}

export async function myStamp(id) {
  const { data, error } = await supabase.rpc('my_stamp', { p_id: id });
  if (error) throw error;
  return data || null;
}

// 行った順に9個ずつ。いちばん新しい台紙が最後
export function sheetsOf(list) {
  const out = [];
  for (let i = 0; i < list.length; i += PER_SHEET) out.push(list.slice(i, i + PER_SHEET));
  if (out.length === 0 || out[out.length - 1].length === PER_SHEET) out.push([]);
  return out;
}

// スタンプの傾き。押すたびに変わると落ち着かないので、場所で決める（確定版は -6〜+5）
export function tiltOf(index) {
  const steps = [-1, 3, -5, 2, -3, 4, -2, 5, -4, 1, -6, 3];
  return steps[index % steps.length];
}

// 日本の今日（スタンプの「今日」の印に使う）
export function todayIso() {
  const n = new Date();
  const jst = new Date(n.getTime() + (9 * 60 + n.getTimezoneOffset()) * 60000);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}`;
}

// 「8.16」
export function shortDate(iso) {
  const v = ymd(iso);
  return v ? `${v.m}.${v.d}` : '';
}

// 日付の文字を「年・月・日」に分ける。
//   「2026-11-09」でも「2026-11-09T00:00:00Z」でも同じように読めるようにする
//   （読めない形だったら null。画面に NaN を出さない）
function ymd(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

// 「2026.11.9」
export function dotDate(iso) {
  const v = ymd(iso);
  return v ? `${v.y}.${v.m}.${v.d}` : '';
}

// 「2026年11月9日（月）」
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
export function longDate(iso) {
  const v = ymd(iso);
  if (!v) return '';
  const w = WEEK[new Date(v.y, v.m - 1, v.d).getDay()];
  return `${v.y}年${v.m}月${v.d}日（${w}）`;
}

// 台紙の期間「2026.8.16 — 9.27」。まだ1個もない台紙は「—」
export function sheetRange(sheet) {
  if (sheet.length === 0) return '—';
  const a = dotDate(sheet[0].visited_on);
  if (sheet.length < PER_SHEET) return `${a} —`;
  return `${a} — ${shortDate(sheet[sheet.length - 1].visited_on)}`;
}
