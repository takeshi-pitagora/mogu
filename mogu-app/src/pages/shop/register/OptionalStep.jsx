import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import {
  FIELD_GROUPS,
  FREE_TEXT_KEY,
  FREE_TEXT_MAX,
  LIMITED_MAX,
  LINK_KEYS,
  LINK_MAX,
  MENU_MAX,
  ADDRESS_KEY,
  PHONE_KEY,
  WEEKDAYS,
  hoursLabel,
  isPicked,
  linkError,
  phoneError,
  setHours,
  toggleField,
} from '../../../lib/shopFields';
import { FULL_FIELDS, FULL_PHOTOS, fullRegisterCount } from '../../../lib/registerForm';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import TextField from '../../../components/ui/TextField';
import Icon from '../../../components/ui/Icon';
import MenuEditor from './MenuEditor';
import HoursSheet from './HoursSheet';
import { PickedChip, TAG_PER_SHOP_MAX } from './TagPickSheet';

// =============================================================
// ⑱-9〜13 任意（1枚の縦スクロール。確定版 Final-18）
//   上の線は8本（しっかり登録 N/8）。必須の5本とは別
//   どれも空けたまま登録できる
// =============================================================

export default function OptionalStep({ form, onChange, bannedInFreeText, onOpenTags }) {
  const [hoursDay, setHoursDay] = useState(null);
  // リンクの欄は、入っている数＋1まで出す（最大3つ）
  const [linkSlots, setLinkSlots] = useState(() =>
    Math.min(LINK_MAX, Math.max(1, LINK_KEYS.filter((k) => form.fields?.[k]).length + 1)));
  const full = fullRegisterCount(form);
  const left = Math.max(0, FULL_PHOTOS + FULL_FIELDS - full.total);

  const fields = form.fields || {};
  const setFields = (next) => onChange({ fields: next });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 上：店名としっかり登録 N/8 */}
      <div style={{ flex: 'none', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {form.name}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          しっかり登録 <span style={{ fontFamily: font.dela, fontSize: 15 }}>{full.total}</span>/{full.max}
        </span>
      </div>
      <div aria-hidden="true" style={{ flex: 'none', display: 'flex', gap: 4, marginTop: 8 }}>
        {Array.from({ length: full.max }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < full.total ? color.accent : color.line }} />
        ))}
      </div>

      <h2 style={{ flex: 'none', margin: '14px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400 }}>ここからは任意</h2>
      <p style={{ flex: 'none', margin: '6px 0 0', fontSize: 13, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
        あとからほかの人も足せるので、空けたまま登録できます。書いたぶんだけ、見る人が助かります
      </p>

      {/* しっかり登録のカード */}
      <div style={{ flex: 'none', marginTop: 14, padding: '14px 16px', borderRadius: 20, background: color.surface }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: font.dela, fontSize: 15 }}>しっかり登録</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>写真3枚と任意の項目5つで ＋5コイン</span>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          <MiniBar label="写真" now={full.photos} max={FULL_PHOTOS} />
          <MiniBar label="任意の項目" now={full.fields} max={FULL_FIELDS} />
        </div>
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>
          {left > 0 ? `任意あと${left}つで ＋5コイン` : 'しっかり登録 ＋5コイン'}
        </div>
      </div>

      {/* おすすめメニュー */}
      <SectionTitle>おすすめメニュー</SectionTitle>
      <MenuEditor
        items={form.menu}
        max={MENU_MAX}
        addLabel={`メニューを足す（${MENU_MAX}品まで）`}
        photos={form.photos}
        onChange={(menu) => onChange({ menu })}
      />

      {/* ハッシュタグ */}
      <SectionTitle hint={`任意・${TAG_PER_SHOP_MAX}つまで`}>ハッシュタグ</SectionTitle>
      <p style={{ flex: 'none', margin: '4px 0 0', fontSize: 13, fontWeight: 500, color: color.sub }}>
        お店のいいところを1語で
      </p>
      <ChipRow style={{ marginTop: 10, alignItems: 'center' }}>
        {form.tags.map((t) => (
          <PickedChip key={t.id || t.name} name={t.name} onRemove={() => onChange({ tags: form.tags.filter((x) => x !== t) })} />
        ))}
        {form.tags.length < TAG_PER_SHOP_MAX && <AddButton label="タグを付ける" onClick={onOpenTags} />}
      </ChipRow>

      {/* 営業時間・定休日 */}
      <SectionTitle>営業時間・定休日</SectionTitle>
      <div style={{ flex: 'none', marginTop: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <button
            key={w}
            type="button"
            onClick={() => setHoursDay(i)}
            className="ui-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 44,
              padding: 0,
              border: 0,
              borderBottom: `1px solid ${color.line}`,
              background: 'transparent',
              color: color.ink,
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ width: 24, fontFamily: font.dela, fontSize: 14 }}>{w}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: hoursLabel(fields, i) ? color.ink : color.sub }}>
              {hoursLabel(fields, i) || '未入力'}
            </span>
            <Icon name="chevronRight" size={16} color={color.sub} />
          </button>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
          変わることがあるので、お店の公式でも確かめてください
        </p>
      </div>

      {/* 選ぶだけの項目 */}
      {FIELD_GROUPS.filter((g) => g.key !== 'seat_count').map((g) => (
        <div key={g.key}>
          <SectionTitle hint={g.hint}>{g.title}</SectionTitle>
          <ChipRow style={{ marginTop: 8 }}>
            {g.options.map((o) => (
              <ChoiceChip key={o} selected={isPicked(fields, g.key, o)} onClick={() => setFields(toggleField(fields, g.key, o))}>
                {o}
              </ChoiceChip>
            ))}
          </ChipRow>
          {g.key === 'reserve' && (
            <div style={{ marginTop: 12 }}>
              <TextField
                label="予約のページのリンク"
                value={fields.reserve_url || ''}
                onChange={(v) => setFields({ ...fields, reserve_url: v })}
                placeholder="https://sample-yoyaku.jp/…"
                error={linkError(fields.reserve_url)}
                inputMode="url"
              />
            </div>
          )}
          {g.key === 'seats' && (
            <>
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700 }}>席数の目安</div>
              <ChipRow style={{ marginTop: 8 }}>
                {FIELD_GROUPS.find((x) => x.key === 'seat_count').options.map((o) => (
                  <ChoiceChip key={o} selected={isPicked(fields, 'seat_count', o)} onClick={() => setFields(toggleField(fields, 'seat_count', o))}>
                    {o}
                  </ChoiceChip>
                ))}
              </ChipRow>
            </>
          )}
        </div>
      ))}

      {/* 住所（地図には使わない。お店に向かうときはコピーして地図アプリへ） */}
      <SectionTitle hint="任意">住所</SectionTitle>
      <p style={{ flex: 'none', margin: '4px 0 0', fontSize: 13, fontWeight: 500, color: color.sub }}>
        地図には使いません。お店に向かうときにコピーできます
      </p>
      <div style={{ marginTop: 8 }}>
        <TextField
          label="住所"
          value={form.fields[ADDRESS_KEY] || ''}
          onChange={(v) => onChange({ fields: { ...form.fields, [ADDRESS_KEY]: v } })}
          placeholder="東京都渋谷区…"
        />
      </div>

      {/* 公式のリンク・電話 */}
      <SectionTitle>公式のリンク・電話</SectionTitle>
      <div style={{ flex: 'none', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LINK_KEYS.slice(0, linkSlots).map((k, i) => (
          <TextField
            key={k}
            label={i === 0 ? `リンク（${LINK_MAX}つまで：Instagram・サイト・予約サイト）` : undefined}
            value={fields[k] || ''}
            onChange={(v) => setFields({ ...fields, [k]: v })}
            placeholder="https://instagram.com/…"
            error={linkError(fields[k])}
            inputMode="url"
          />
        ))}
        {linkSlots < LINK_MAX && <AddButton label="リンクを足す" onClick={() => setLinkSlots(linkSlots + 1)} />}
        <TextField
          label="お店の電話番号"
          value={fields[PHONE_KEY] || ''}
          onChange={(v) => setFields({ ...fields, [PHONE_KEY]: v })}
          placeholder="03-0000-0000"
          error={phoneError(fields[PHONE_KEY])}
          inputMode="tel"
        />
      </div>

      {/* 期間限定メニュー */}
      <SectionTitle>期間限定メニュー</SectionTitle>
      <MenuEditor
        items={form.limited || []}
        max={LIMITED_MAX}
        addLabel={`期間限定メニューを足す（${LIMITED_MAX}つまで）`}
        photos={form.photos}
        onChange={(limited) => onChange({ limited })}
        dated
      />

      {/* 自由記入 */}
      <SectionTitle>自由記入</SectionTitle>
      <div style={{ flex: 'none', marginTop: 8 }}>
        <TextField
          label="お店のことなら何でも"
          value={fields[FREE_TEXT_KEY] || ''}
          onChange={(v) => setFields({ ...fields, [FREE_TEXT_KEY]: v })}
          multiline
          rows={4}
          maxLength={FREE_TEXT_MAX}
          showCount
          error={bannedInFreeText ? '使えない言葉が含まれています' : null}
        />
      </div>

      {hoursDay != null && (
        <HoursSheet
          day={hoursDay}
          value={hoursLabel(fields, hoursDay)}
          onDone={(v) => {
            setFields(setHours(fields, hoursDay, v));
            setHoursDay(null);
          }}
          onCancel={() => setHoursDay(null)}
        />
      )}
    </div>
  );
}

function SectionTitle({ children, hint }) {
  return (
    <h3 style={{ flex: 'none', margin: '22px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>
      {children}
      <span style={{ flex: 'none', fontFamily: font.body, fontSize: 12, fontWeight: 700, color: color.sub }}>{hint || '任意'}</span>
    </h3>
  );
}

function MiniBar({ label, now, max }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
        <span>{label}</span>
        <span>
          {now}/{max}
        </span>
      </div>
      <div style={{ marginTop: 5 }}>
        <span aria-hidden="true" style={{ display: 'block', width: '100%', height: 6, borderRadius: 3, background: color.line, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${Math.round((now / max) * 100)}%`, height: '100%', background: color.accent }} />
        </span>
      </div>
    </div>
  );
}

function AddButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn"
      style={{
        flex: 'none',
        alignSelf: 'flex-start',
        height: 44,
        padding: '0 16px',
        boxSizing: 'border-box',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 22,
        background: color.white,
        color: color.ink,
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}
