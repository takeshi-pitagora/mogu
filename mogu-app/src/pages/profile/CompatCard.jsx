import { color, font, stroke } from '../../theme/tokens';
import { chara } from '../../lib/chara';
import { groupColor, groupOf } from '../../theme/tokens';
import { AXIS_MAX, COMPAT_AXES, axesOf, compatPercent, compatText } from '../../lib/compat';

// =============================================================
// ③-11・12「あなたとの相性」
//   半円のゲージ（50〜100）・帯の見出しと文・「ふたりの位置」（2つの軸）
//   自分が未診断のときは、代わりに［食スタイル診断をする］（③-14）
// =============================================================

const R = 86;
const CX = 110;
const CY = 100;

// 半円の道（左から右へ）
const arc = (from, to) => {
  const p = (t) => {
    const a = Math.PI * (1 - t);
    return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
  };
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
};

function Face({ code, label, name }) {
  const ch = code ? chara(code) : null;
  const g = code ? groupColor[groupOf(code)] : null;
  return (
    <div style={{ flex: 'none', width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 84, height: 84, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, overflow: 'hidden', background: g ? g.light : color.surface, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {ch?.display ? <img src={ch.display} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: font.dela, fontSize: 34 }}>？</span>}
      </span>
      <span style={{ fontFamily: font.dela, fontSize: 15, color: g ? g.dark : color.ink }}>{code || '—'}</span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label || name}</span>
    </div>
  );
}

// 1本の軸（ふたりの位置）
function AxisRow({ axis, mine, theirs, meName, youName }) {
  const pos = (v) => `${(v / AXIS_MAX) * 100}%`;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: color.sub }}>{axis.label}</div>
      <div style={{ position: 'relative', height: 30, marginTop: 8 }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 11, height: 8, borderRadius: 4, background: color.surface }} />
        <span aria-label={`あなた ${axis.left}〜${axis.right}`} style={{ position: 'absolute', left: pos(mine), top: 0, transform: 'translateX(-50%)', width: 30, height: 30, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, background: '#5E4B3C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#C77B52' }} />
        </span>
        <span aria-label={`${youName} ${axis.left}〜${axis.right}`} style={{ position: 'absolute', left: pos(theirs), top: 0, transform: 'translateX(-50%)', width: 30, height: 30, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, background: '#3C3630', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#E0B23F' }} />
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
        <span>{axis.left}</span>
        <span>{axis.right}</span>
      </div>
      <span style={{ display: 'none' }}>{meName}</span>
    </div>
  );
}

export default function CompatCard({ me, you, youName, onDiagnose }) {
  const myCode = me?.moguType?.code;
  const yourCode = you?.type_code;

  // ③-14 自分がまだ診断していないとき
  if (!myCode) {
    return (
      <div style={{ marginTop: 20, padding: '22px 18px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, background: color.white, textAlign: 'center' }}>
        <div style={{ fontFamily: font.dela, fontSize: 17 }}>あなたとの相性</div>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.65, color: color.sub }}>
          食スタイル診断を受けると、{youName}さんとの相性が出ます
        </p>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onDiagnose} style={{ minHeight: 48, marginTop: 14, padding: '0 22px', border: 0, borderRadius: 24, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
          食スタイル診断をする
        </button>
      </div>
    );
  }

  const pct = compatPercent({ food_axes: me?.foodAxes || me?.food_axes }, you);
  const text = compatText({ food_axes: me?.foodAxes || me?.food_axes }, you);
  const t = Math.max(0, Math.min(1, (pct - 50) / 50)); // 50〜100 をゲージの 0〜1 に
  const mine = axesOf({ food_axes: me?.foodAxes || me?.food_axes });
  const theirs = axesOf(you);
  const knobA = Math.PI * (1 - t);

  return (
    <div style={{ marginTop: 20, padding: '18px 16px 20px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, background: color.white }}>
      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700 }}>あなたとの相性</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 10 }}>
        <Face code={myCode} label="あなた" />
        <div style={{ position: 'relative', flex: 1, minWidth: 0, height: 120 }}>
          <svg viewBox="0 0 220 120" width="100%" height="120" aria-label={`相性 ${pct}パーセント`}>
            <path d={arc(0, 1)} fill="none" stroke={color.surface} strokeWidth="14" strokeLinecap="round" />
            <path d={arc(0, Math.max(0.02, t))} fill="none" stroke="#B0735A" strokeWidth="14" strokeLinecap="round" />
            {[0.08, 0.3, 0.7, 0.92].map((k) => {
              const a = Math.PI * (1 - k);
              const x1 = CX + (R + 13) * Math.cos(a);
              const y1 = CY - (R + 13) * Math.sin(a);
              const x2 = CX + (R + 20) * Math.cos(a);
              const y2 = CY - (R + 20) * Math.sin(a);
              return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color.lineStrong} strokeWidth="3" strokeLinecap="round" />;
            })}
            <circle cx={CX + R * Math.cos(knobA)} cy={CY - R * Math.sin(knobA)} r="11" fill={color.white} stroke={color.ink} strokeWidth="2.5" />
          </svg>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
            <span style={{ fontFamily: font.dela, fontSize: 40, lineHeight: 1 }}>{pct}</span>
            <span style={{ fontFamily: font.dela, fontSize: 19 }}>%</span>
          </div>
          <span style={{ position: 'absolute', left: 0, bottom: 7, fontSize: 12, fontWeight: 700, color: color.sub }}>50</span>
          <span style={{ position: 'absolute', right: 0, bottom: 7, fontSize: 12, fontWeight: 700, color: color.sub }}>100</span>
        </div>
        <Face code={yourCode} label={youName} />
      </div>

      <h3 style={{ margin: '12px 0 0', fontFamily: font.dela, fontSize: 19, fontWeight: 400, lineHeight: 1.35, textAlign: 'center' }}>{text.title}</h3>
      <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.7, color: color.sub, textAlign: 'center' }}>{text.body}</p>

      <div style={{ marginTop: 16, borderTop: `2px dashed ${color.lineStrong}`, paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontFamily: font.dela, fontSize: 16 }}>ふたりの位置</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, background: '#5E4B3C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#C77B52' }} />
              </span>
              あなた
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, background: '#3C3630', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#E0B23F' }} />
              </span>
              {youName}
            </span>
          </span>
        </div>

        {COMPAT_AXES.map((axis) => (
          <AxisRow key={axis.key} axis={axis} mine={mine[axis.key]} theirs={theirs[axis.key]} meName="あなた" youName={youName} />
        ))}

        <p style={{ margin: '14px 0 0', fontSize: 13, color: color.sub }}>相性は、この2つの近さで決まります（50〜100%）</p>
      </div>
    </div>
  );
}
