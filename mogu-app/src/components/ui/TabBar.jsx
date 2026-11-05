import { useLayoutEffect, useRef, useState } from 'react';
import { color, font, stroke, tabBar as T, type } from '../../theme/tokens';
import Icon from './Icon';
import Avatar from './Avatar';

// §4-10 浮いた下のタブ（確定版 Final-01-02-Tabs・Final-15 の見本のまま）
//   バー：高さ66・角丸33・白の地に2ptの黒いふち・左右16・下28・内側3
//   並び：ホーム／グループ／保存／プロフィール
//   選択中のカプセル：高さ56・角丸28・グレー2 ペブル。選択中だけ幅が1.6倍。選択が移るとき横にすべって移る
//   選択中：塗りのアイコン・Dela・ink／ほか：線のアイコン・Plex Medium・sub
//   プロフィールはアイコンの代わりに本人の写真の丸（26）。ゲストはグループに小さな鍵、プロフィールは人の形の丸
const TABS = [
  { key: 'home', label: 'ホーム', o: 'tab_home_o', f: 'tab_home_f' },
  { key: 'group', label: 'グループ', o: 'tab_group_o', f: 'tab_group_f' },
  { key: 'saved', label: '保存', o: 'tab_saved_o', f: 'tab_saved_f' },
  { key: 'profile', label: 'プロフィール' },
];

export default function TabBar({ active, onChange, profile = {}, guest = false }) {
  const navRef = useRef(null);
  const [inner, setInner] = useState(0);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;
    const measure = () => setInner(el.clientWidth - T.padding * 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const units = TABS.length - 1 + T.activeGrow;
  const unit = inner / units;
  const idx = Math.max(0, TABS.findIndex((t) => t.key === active));
  const capsuleLeft = T.padding + unit * idx;
  const capsuleWidth = unit * T.activeGrow;

  return (
    <nav
      ref={navRef}
      aria-label="下のタブ"
      style={{
        position: 'fixed',
        left: T.sideInset,
        right: T.sideInset,
        bottom: T.bottomInset,
        height: T.height,
        boxSizing: 'border-box',
        padding: T.padding,
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: T.radius,
        background: color.bg,
        display: 'flex',
        zIndex: 40,
        maxWidth: 448,
        margin: '0 auto',
      }}
    >
      {inner > 0 && (
        <span
          aria-hidden="true"
          className="ui-tab-capsule"
          style={{ position: 'absolute', top: T.padding, left: capsuleLeft, width: capsuleWidth, height: T.capsuleHeight, borderRadius: T.capsuleRadius, background: color.tabActive }}
        />
      )}
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            className="ui-tab-item"
            aria-current={on ? 'page' : undefined}
            aria-label={t.key === 'group' && guest ? 'グループ（登録すると使えます）' : t.label}
            onClick={() => onChange?.(t.key)}
            style={{
              position: 'relative',
              flex: `${on ? T.activeGrow : 1} 1 0px`,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: T.iconGap,
              border: 0,
              padding: 0,
              borderRadius: T.capsuleRadius,
              background: 'transparent',
              color: on ? color.ink : color.sub,
            }}
          >
            <span style={{ position: 'relative', display: 'block' }}>
              {t.key === 'profile' ? (
                <Avatar size={T.photoSize} photoUrl={profile.photoUrl} name={profile.name} guest={guest} label={guest ? 'ゲスト' : '写真'} />
              ) : (
                <Icon name={on ? t.f : t.o} size={T.iconSize} />
              )}
              {t.key === 'group' && guest && (
                // 小さな鍵の印（黒い丸に白い鍵。確定版 Final-14 の見本の位置）
                <span
                  aria-hidden="true"
                  style={{ position: 'absolute', left: 18, top: -5, width: 20, height: 20, boxSizing: 'border-box', border: `2px solid ${color.white}`, borderRadius: '50%', background: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="lockSmall" size={11} strokeWidth={2.6} color={color.white} />
                </span>
              )}
            </span>
            <span style={{ ...(on ? type.tabActive : type.tab), fontFamily: on ? font.dela : font.plex, whiteSpace: 'nowrap' }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
