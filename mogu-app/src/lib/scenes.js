// =============================================================
// ㉔ ホームのシーン6つ（引き渡し書 §5 ㉔ の表のまま）
//   キャラは確定版の素材をそのまま使う。タグは「すべて持つお店」で絞る
// =============================================================
export const SCENES = [
  { key: 'work', label: '作業したい', chara: 'TNBL', tags: ['電源あり', 'Wi-Fiあり', '長居できる'] },
  { key: 'quick', label: 'サク飲み', chara: 'TNBP', tags: ['サク飲み', 'せんべろ', '一人で入りやすい'] },
  { key: 'date', label: 'デート', chara: 'VFGL', tags: ['デート', '落ち着く', '夜景'] },
  { key: 'party', label: '大人数', chara: 'TFGP', tags: ['大人数OK', '個室', '飲み放題'] },
  { key: 'morning', label: '朝ごはん', chara: 'VFBP', tags: ['朝ごはん', 'モーニング'] },
  { key: 'alone', label: 'ひとりで', chara: 'TFBL', tags: ['一人で入りやすい', '1人OK'] },
];

export const sceneOf = (key) => SCENES.find((s) => s.key === key) || null;
