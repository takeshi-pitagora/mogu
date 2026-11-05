// =============================================================
// mogu デザインの決まり（確定版 ①案5 ラウド × B）の値
// 出典：実装引き渡し書 §3・§4、確定版キャンバス（Final-01〜15）
//
// 画面のファイルには色や寸法の値を直接書かず、ここから使うこと。
// 値を変えるのは、確定デザインが変わったときだけ。
// =============================================================

// §3-1 色
export const color = {
  bg: '#FFFFFF', // 地：画面の背景、副のボタン
  surface: '#EFEBE4', // 面（クリーム）：カード・チップ・入力欄の地、印の丸、説明の箱、押せないボタン
  surfacePressed: '#E2DCD2',
  ink: '#2E2C2A', // 文字・主のボタン・形の線とまとまりの線（2pt）
  inkPressed: '#4A4643',
  sub: '#6B6560', // 補足の文字、選ばれていないタブ
  line: '#E3DED6', // 行の線（まとまりの中の行と行）。文字には使わない
  lineStrong: '#D3CCC2', // 行の線（濃い方）
  accent: '#C08268', // 1画面1か所。自分のいいね・スイッチのオン・進み具合。形だけに使う
  accentPressed: '#A86C53',
  red: '#C62828', // 危険な操作、入力のまちがい、通知の赤い点だけ
  redPressed: '#A32020',
  redBg: '#FBECEC',
  tabActive: '#DEDAD5', // 下のタブの選択中のカプセル（グレー2 ペブル）
  scrim: 'rgba(46,44,42,0.48)', // 下から出るシートのうしろの幕
  white: '#FFFFFF',
};

// グループ色（キャラとタイプのラベルのまわりだけ）。タイプの頭2文字で決まる
// 淡い色の上の文字は ink、濃い色の上の文字は白
export const groupColor = {
  VN: { light: '#FBE3D6', dark: '#B0603F' }, // 映え×新規開拓
  VF: { light: '#F6E1E7', dark: '#9E5E70' }, // 映え×行きつけ
  TN: { light: '#E2EDE5', dark: '#4F7365' }, // 味×新規開拓
  TF: { light: '#F7EAD1', dark: '#8E6D22' }, // 味×行きつけ
};

export const groupOf = (typeCode) => {
  const g = String(typeCode || '').slice(0, 2).toUpperCase();
  return groupColor[g] ? g : null;
};

// この場所だけで使う色
export const swipeColor = {
  like: { text: '#283593', glow: '#0047AB' }, // 右（いいね）
  pass: { text: '#36454F', glow: '#C9CDD2' }, // 左（パス）
};
export const appIconBg = { light: '#F7EAD1', dark: '#2E2C2A' };

// §3-2 文字
export const font = {
  dela: "'Dela Gothic One', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif", // 見出しと数字（極太・400のみ）
  plex: "'IBM Plex Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif", // 本文
};

export const type = {
  screenTitle: { fontFamily: font.dela, fontSize: 30, fontWeight: 400, lineHeight: 1.2 },
  screenTitleLarge: { fontFamily: font.dela, fontSize: 36, fontWeight: 400, lineHeight: 1.2 },
  emptyTitle: { fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.2 },
  sheetTitle: { fontFamily: font.dela, fontSize: 18, fontWeight: 400, lineHeight: 1.2 },
  profileName: { fontFamily: font.dela, fontSize: 24, fontWeight: 400, lineHeight: 1.2 },
  body: { fontFamily: font.plex, fontSize: 15, fontWeight: 400, lineHeight: 1.6 },
  caption: { fontFamily: font.plex, fontSize: 12, fontWeight: 500, lineHeight: 1.5 },
  numberLarge: { fontFamily: font.dela, fontSize: 48, fontWeight: 400, lineHeight: 1 },
  numberMid: { fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1 },
  tabActive: { fontFamily: font.dela, fontSize: 11, fontWeight: 400, lineHeight: '14px' },
  tab: { fontFamily: font.plex, fontSize: 11, fontWeight: 500, lineHeight: '14px' },
};

// §3-3 角丸・余白・線・影
export const radius = {
  card: 32,
  sheet: 32, // 上だけ
  photo: 32, // お店の写真
  round: 9999, // ボタン・チップ・人の写真は「まる」
};

export const space = [4, 8, 12, 20, 32, 48]; // 余白の刻み

export const layout = {
  screenX: 20, // 画面の左右
  screenXTight: 16, // ホームのお店カードと、プロフィール上部の2列
  headingGap: 12, // 見出しの下
  sectionGap: 28, // まとまりの間
  rowMin: 56, // 行の高さ（1行）
  rowMin2: 64, // 行の高さ（2行）
  scrollBottom: 130, // スクロールする画面の下（浮いたタブに隠れないように）
};

export const stroke = {
  shape: 2, // 形の線：副のボタン・チップ・入力欄・下のタブのふち・人の写真
  focus: 3, // 入力中
  row: 1, // 行の線（color.line）
  icon: 2.75, // アイコンの線
};

// §4-10 浮いた下のタブ
export const tabBar = {
  height: 66,
  radius: 33,
  sideInset: 16,
  bottomInset: 28,
  padding: 3,
  capsuleHeight: 56,
  capsuleRadius: 28,
  activeGrow: 1.6, // 選択中だけ幅が 1.6 倍
  iconSize: 24,
  iconGap: 2,
  photoSize: 26,
};

// §4-1 ボタン
export const button = {
  primary: { height: 56, fontSize: 16 },
  danger: { height: 56, fontSize: 16 },
  secondary: { height: 52, fontSize: 15, gapAbove: 10 },
  small: { height: 44, fontSize: 13 },
  bar: { height: 36 },
};

// §4-3 下から出るシート
export const sheet = {
  grip: { width: 40, height: 5 },
  padding: '10px 20px 34px',
  chara: { right: 22, width: 80, height: 122, overlap: 10 }, // キャラの下の端はシートの上のふちから10下
  titleRightSpace: 76,
};

// §4-5 短い知らせ
export const toast = {
  minHeight: 60,
  radius: 30,
  bottomWithTab: 106, // 下のタブの上に 12
  bottomNoTab: 34,
  side: 16,
  duration: 4000,
  durationUndo: 6000,
};

// §4-8 写真の丸
export const avatarSize = { edit: 96, large: 56, row: 40, stack: 32, tab: 26 };

// 押せるものの最小の大きさ
export const hitSize = 44;
