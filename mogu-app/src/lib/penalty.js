import { supabase } from './supabase';

// =============================================================
// ㉗ 警告・停止と、投稿のルール（確定版 Final-27）
//   言い方は落ち着いて。責める言葉・びっくりマーク・赤い大きな文字は使わない
//   罰則はほかの人には見せない
// =============================================================

export const STAGES = {
  notice: { label: '注意', order: 1 },
  warning: { label: '警告', order: 2 },
  suspended: { label: '30日間の投稿停止', order: 3 },
  banned: { label: 'アカウント停止', order: 4 },
};

export const APPEAL_MAX = 1000;

// いま効いている罰則（止められていれば、いつまでか）
export async function fetchMyPenalty() {
  const { data, error } = await supabase.rpc('my_active_penalty');
  if (error) return null;
  return data || null;
}

// 自分についた罰則を新しい順に（通知の行から開くため）
export async function fetchPenalty(id) {
  const { data, error } = await supabase.from('penalties').select('*').eq('id', id).maybeSingle();
  if (error) return null;
  return data || null;
}

// この判断について問い合わせる（㉗-6・7）
export async function submitAppeal({ penaltyId, body, photoPaths }) {
  const { data, error } = await supabase.rpc('submit_appeal', {
    p_penalty_id: penaltyId || null,
    p_body: body,
    p_photo_paths: photoPaths || [],
  });
  if (error) throw error;
  return data;
}

// ends_at は「また投稿できるようになる時こく」。
// 「◯月◯日まで」はその1つ前の日、「◯月◯日から」はその次の日。
function lastDay(iso) {
  return new Date(new Date(iso).getTime() - 1);
}

export function untilLabel(iso) {
  if (!iso) return null;
  const d = lastDay(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function nextDayLabel(iso) {
  if (!iso) return null;
  const d = lastDay(iso);
  d.setDate(d.getDate() + 1);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 投稿が止められているか（画面を出す前に見る）
export function isSuspended(p) {
  if (!p) return false;
  if (p.stage === 'banned') return true;
  if (p.stage !== 'suspended') return false;
  return !p.ends_at || new Date(p.ends_at) > new Date();
}

// ---- 投稿のルール（㉗-17・18。⑤の「このアプリについて」の上からも開ける） ----
export const POST_RULES = [
  {
    title: '自分で撮った写真だけ',
    body: 'お店で自分が撮った写真を入れてください。ほかの人の写真やお店の公式の写真は使えません。',
  },
  {
    title: 'ほかのお客さんの顔を写さない',
    body: '人の顔が写らないように撮ってください。写ってしまったときは、入れないでください。',
  },
  {
    title: '行ったお店だけを登録する',
    body: '存在しないお店や、行っていないお店は登録しないでください。',
  },
  {
    title: 'お店の関係者は登録しない',
    body: 'そのお店で働いている人・関係者は、自分のお店を登録できません。',
  },
  {
    title: 'お店を貶めない',
    body: 'ひとことやタグで、お店や人を傷つける言い方はしないでください。合わなかったことは、事実として書いてください。',
  },
  {
    title: '宣伝に使わない',
    body: 'お店や自分の宣伝のための投稿はしないでください。',
  },
];

export const RULE_STAGES = [
  { stage: 'notice', body: '写真や文を消し、そのぶんのコインを取り消します。' },
  { stage: 'warning', body: '投稿を消し、コインを取り消します。90日以内にもう1回警告を受けると、30日間投稿できなくなります。' },
  { stage: 'suspended', body: '30日間、お店の登録・写真・タグ・ひとことができなくなります。見る・スワイプ・保存はできます。' },
  { stage: 'banned', body: 'アカウントが使えなくなります。コインはすべて消えます。' },
];
