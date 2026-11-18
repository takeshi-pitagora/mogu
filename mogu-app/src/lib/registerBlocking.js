import { stepDone } from './registerForm';

// ⑱-15「あと2つ：写真・関係者ではないことのチェック」
//   ［登録する］を押せない理由を、確定版の順に並べる
export function blockingLabels(form) {
  const out = [];
  if (!stepDone(form, 'photos')) out.push('写真');
  if (!stepDone(form, 'station')) out.push('最寄駅');
  if (!stepDone(form, 'genre')) out.push('ジャンル');
  if (!stepDone(form, 'visit')) out.push('行った日と予算感');
  if (!stepDone(form, 'highlight')) out.push('イチ押しポイント');
  if (!form.notRelated) out.push('関係者ではないことのチェック');
  return out;
}
