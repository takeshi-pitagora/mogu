import { supabase } from './supabase';

// =============================================================
// ㉓ 修正依頼・閉店の報告・通報（確定版 Final-23）
//   どれも下から出るシートの中で進む。お店のページから離れない
// =============================================================

// どうやって知った？
export const HOW_KNOWN = ['行った', 'お店の公式で見た', 'お店の人に聞いた', 'その他'];

// 閉店・移転（㉓-12）
export const CLOSURE_TYPES = [
  { value: 'closed', label: '閉店した' },
  { value: 'moved', label: '移転した' },
  { value: 'resting', label: 'しばらく休業中' },
];

// 通報の理由（㉓-14・17。「その他」はその場で200字まで）
export const REPORT_REASONS = {
  shop: ['存在しないお店', 'お店を貶める内容', 'お店の関係者の宣伝', '不適切な写真', 'その他'],
  photo: ['不適切な内容', 'ほかの人の写真を無断で使っている', 'お店と関係ない', 'その他'],
  comment: ['不適切な内容', 'ほかの人の文章を無断で使っている', 'お店と関係ない', 'その他'],
  tag: ['不適切な内容', 'お店と関係ない', 'その他'],
};
export const REPORT_TITLE = {
  shop: 'このお店を通報する',
  photo: '写真を通報する',
  comment: 'ひとことを通報する',
  tag: 'タグを通報する',
};
export const REPORT_DETAIL_MAX = 200;

// 修正を依頼できる項目（㉓-4。予算感は「みんなの投票」なので入れない）
export const EDITABLE_FIELDS = [
  { key: '__hours', title: '営業時間・定休日' },
  { key: 'reserve', title: '予約' },
  { key: 'payment', title: '支払い' },
  { key: 'seats', title: '席' },
  { key: 'seat_count', title: '席数の目安' },
  { key: 'party', title: '何人で行くか' },
  { key: 'smoking', title: 'たばこ' },
  { key: 'facility', title: '設備' },
  { key: 'phone', title: '電話' },
  { key: 'free_text', title: '自由記入' },
];

export async function submitEditRequest({ shopId, fieldKey, proposed, howKnown, evidence }) {
  const { data, error } = await supabase.rpc('submit_edit_request', {
    p_shop_id: shopId,
    p_field_key: fieldKey,
    p_proposed: proposed,
    p_how_known: howKnown || null,
    p_evidence: evidence || null,
  });
  if (error) throw error;
  return data;
}

export async function submitClosureReport({ shopId, type, movedTo, howKnown, evidence }) {
  const { data, error } = await supabase.rpc('submit_closure_report', {
    p_shop_id: shopId,
    p_type: type,
    p_moved_to: movedTo || null,
    p_how_known: howKnown || null,
    p_evidence: evidence || null,
  });
  if (error) throw error;
  return data;
}

export async function submitShopReport({ kind, shopId, targetId, reason, detail }) {
  const { data, error } = await supabase.rpc('submit_shop_report', {
    p_kind: kind,
    p_shop_id: shopId,
    p_target: targetId || null,
    p_reason: reason,
    p_detail: detail || null,
  });
  if (error) throw error;
  return data;
}

export async function fetchCheckingFields(shopId) {
  const { data, error } = await supabase.rpc('shop_checking_fields', { p_shop_id: shopId });
  if (error) return [];
  return data || [];
}

const MESSAGES = {
  not_signed_in: 'ログインしてから送れます。',
  posting_suspended: 'いまは投稿ができません。お知らせを見てください。',
  already_checking: 'この項目は、いまほかの人の依頼を確かめているところです。',
  same_as_current: '今の内容と同じです。直すところを変えてください。',
  banned_word: '使えない言葉が含まれています。',
  proposed_required: '正しい内容を入れてください。',
  reason_required: '理由を1つ選んでください。',
  detail_too_long: '200字までです。',
};

export function reportErrorMessage(err) {
  const raw = String(err?.message || '');
  const key = Object.keys(MESSAGES).find((k) => raw.includes(k));
  return key ? MESSAGES[key] : '送れませんでした。少し待ってもう一度お願いします。';
}
