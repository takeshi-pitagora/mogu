import { clearDraft, registerShop } from '../../../lib/shops';
import { removeShopPhotos, uploadShopPhoto } from '../../../lib/shopPhoto';
import { FREE_TEXT_KEY, LINK_KEYS, PHONE_KEY, linkError, phoneError } from '../../../lib/shopFields';

// ⑱-18 登録する
//   1. 写真を Storage に入れる
//   2. register_shop を呼ぶ（中身の確かめはサーバーがする）
//   3. 失敗したら、入れた写真を消して、入力はそのまま残す
export async function submitRegistration(userId, form) {
  const good = form.photos.filter((p) => !p.tooSmall);
  const uploaded = [];
  try {
    for (const p of good) {
      // 1枚ずつ。途中で失敗したら、ここまでの写真を消す
      uploaded.push(await uploadShopPhoto(userId, p));
    }

    const shopId = await registerShop({
      name: form.name,
      stationId: form.station.id,
      walkMin: Number(form.walkMin),
      genreMain: form.genreMain,
      genreSub: form.genreSub,
      visitedOn: form.visitedOn,
      timeOfDay: form.timeOfDay,
      budgetBucket: form.budgetBucket,
      gender: form.gender,
      highlightKeys: form.highlightKeys,
      highlightReason: form.highlightReason?.trim() || null,
      photos: uploaded,
      fields: cleanFields(form.fields),
      tags: form.tags.map((t) => t.name),
      menu: cleanMenu(form, good),
      comment: form.fields?.[FREE_TEXT_KEY]?.trim() || null,
    });

    await clearDraft();
    return shopId;
  } catch (e) {
    await removeShopPhotos(uploaded.flatMap((u) => [u.path, u.card_path]));
    throw e;
  }
}

// 空の項目と、形がおかしいリンク・電話は送らない
function cleanFields(fields) {
  const out = {};
  Object.entries(fields || {}).forEach(([k, v]) => {
    const value = String(v ?? '').trim();
    if (value === '') return;
    if (k === FREE_TEXT_KEY) return; // ひとことは p_comment で送る
    if (LINK_KEYS.includes(k) && linkError(value)) return;
    if (k === 'reserve_url' && linkError(value)) return;
    if (k === PHONE_KEY && phoneError(value)) return;
    out[k] = value;
  });
  return out;
}

// おすすめメニューと期間限定メニューを1つにまとめる
//   photo_index は、送る写真の何番目か（0から）。register_shop が id につなぐ
function cleanMenu(form, photos) {
  const indexOf = (id) => {
    const i = photos.findIndex((p) => p.id === id);
    return i >= 0 ? i : null;
  };
  const rows = [];
  (form.menu || []).forEach((m) => {
    const name = String(m.name ?? '').trim();
    if (!name) return;
    const price = String(m.price ?? '').trim();
    rows.push({ name, price: price === '' ? null : Number(price), photo_index: indexOf(m.photoId) });
  });
  (form.limited || []).forEach((m) => {
    const name = String(m.name ?? '').trim();
    if (!name) return;
    rows.push({ name, price: null, limited_until: m.until || null, photo_index: indexOf(m.photoId) });
  });
  return rows;
}

// 下書きに残す形（写真は入れない）
export function draftBody(form) {
  const { photos, ...rest } = form;
  return { ...rest, photoCount: photos.filter((p) => !p.tooSmall).length };
}
