import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import TabBar from './components/ui/TabBar';
import { color } from './theme/tokens';
import Splash from './pages/Splash';
import LoginFlow from './pages/login/LoginFlow';
import HomeScreen from './pages/home/HomeScreen';
import SavedScreen from './pages/saved/SavedScreen';
import ShopDetail from './pages/shop/ShopDetail';
import GroupScreen from './pages/group/GroupScreen';
import ProfileScreen from './pages/profile/ProfileScreen';
import NotificationsScreen from './pages/notifications/NotificationsScreen';
import SettingsScreen from './pages/settings/SettingsScreen';
import AccountScreen from './pages/settings/AccountScreen';
import PasswordScreen from './pages/settings/PasswordScreen';
import InviteScopeScreen from './pages/settings/InviteScopeScreen';
import BlockedUsersScreen from './pages/settings/BlockedUsersScreen';
import { photoUrlOf } from './lib/profile';
import { GuestGroupLocked, GuestProfile, GuestRegisterSheet, GuestSampleGroupRow, GuestSignupScreen, GuestWelcome } from './pages/guest/GuestParts';
import HandlePromptScreen from './pages/login/HandlePromptScreen';
import DiagnosisScreen from './pages/profile/DiagnosisScreen';
import { parseFriendCodeFromUrl } from './lib/mogutypeApi';

// アプリの外側（引き渡し書 §4-10・§4-11）
//   浮いた下のタブ「ホーム／グループ／保存／プロフィール」と、各タブの中の画面（設定・お知らせなど）。
//   中の画面に移っても下のタブは出たまま（確定版 Final-05・Final-10）。お店の詳細だけは下のタブの上に重ねる（Final-09）
function Shell() {
  const { user } = useAuth();
  const guest = !!user?.isGuest;
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]); // 今のタブの中の画面 [{ name, props }]
  const [shop, setShop] = useState(null); // { shop, from }
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [guideRequest, setGuideRequest] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const [guestSheet, setGuestSheet] = useState(false);
  const [guestFlow, setGuestFlow] = useState(null); // null | 'signup' | { welcome: true, pendingEmail }
  const [diagnosis, setDiagnosis] = useState(null); // null | { intent } … マイページの［診断］／設定の「食スタイル診断」の画面
  const [pendingFriendCode, setPendingFriendCode] = useState(null); // mogu://mogu-type/link で受け取ったフレンドコード

  const push = useCallback((name, props = {}) => setStack((s) => [...s, { name, props }]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const changeTab = (t) => {
    setStack([]);
    if (guestFlow === 'signup') setGuestFlow(null);
    setTab(t);
  };
  const openShop = useCallback((s, opts = {}) => setShop({ shop: s, from: opts.from || 'saved' }), []);
  const openGuestSheet = useCallback(() => setGuestSheet(true), []);
  const openDiagnosis = useCallback((intent) => setDiagnosis({ intent }), []);

  // Mogu Type連携（§4-3・§4-4）：Safariから mogu://mogu-type/link?friendCode=... で戻ってきたとき
  useEffect(() => {
    const sub = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      const code = parseFriendCodeFromUrl(url);
      if (!code) return;
      setPendingFriendCode(code);
      setDiagnosis((d) => d || {});
    });
    return () => {
      sub.then((s) => s.remove()).catch(() => {});
    };
  }, []);

  const top = stack[stack.length - 1];

  const renderSub = (item) => {
    switch (item.name) {
      case 'notifications':
        return <NotificationsScreen onBack={pop} />;
      case 'settings':
        return (
          <SettingsScreen
            onBack={pop}
            onOpenAccount={() => push('account')}
            onOpenInviteScope={() => push('inviteScope')}
            onOpenBlocked={() => push('blockedUsers')}
            onOpenDiagnosis={openDiagnosis}
            onShowGuide={() => {
              setStack([]);
              setTab('home');
              setGuideRequest((n) => n + 1);
            }}
            onRegister={() => setGuestFlow('signup')}
          />
        );
      case 'account':
        return <AccountScreen onBack={pop} onOpenPassword={() => push('password')} />;
      case 'password':
        return <PasswordScreen onBack={pop} />;
      case 'inviteScope':
        return <InviteScopeScreen onBack={pop} />;
      case 'blockedUsers':
        return <BlockedUsersScreen onBack={pop} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: color.bg, overflow: 'hidden' }}>
      {/* ホームはスワイプの途中を残すため、ほかのタブにいる間も消さずに隠す */}
      <div style={{ position: 'absolute', inset: 0, visibility: tab === 'home' && !top ? 'visible' : 'hidden' }}>
        <HomeScreen
          selectedGroup={guest ? null : selectedGroup}
          onSelectGroup={setSelectedGroup}
          onOpenShop={openShop}
          onOpenNotifications={() => push('notifications')}
          unread={false}
          guideRequest={guideRequest}
          guestSlot={guest ? (close) => <GuestSampleGroupRow onRegister={() => { close(); setGuestFlow('signup'); }} /> : undefined}
          onGuestLocked={openGuestSheet}
        />
      </div>
      {!top && tab === 'group' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {guest ? (
            <GuestGroupLocked onRegister={() => setGuestFlow('signup')} onLocked={openGuestSheet} locked={guestSheet} />
          ) : (
            <GroupScreen selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} />
          )}
        </div>
      )}
      {!top && tab === 'saved' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <SavedScreen version={savedVersion} onOpenShop={openShop} onGoHome={() => changeTab('home')} onRegister={() => setGuestFlow('signup')} onGuestLocked={openGuestSheet} />
        </div>
      )}
      {!top && tab === 'profile' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {guest ? <GuestProfile onRegister={() => setGuestFlow('signup')} onOpenSettings={() => push('settings')} /> : <ProfileScreen onOpenSettings={() => push('settings')} onOpenDiagnosis={openDiagnosis} />}
        </div>
      )}
      {top && (
        <div key={stack.length} style={{ position: 'absolute', inset: 0, background: color.bg }}>
          {renderSub(top)}
        </div>
      )}
      {/* ゲストの登録（確定版 Final-14 の 8：下のタブは出たまま。タブを押すと登録をやめる） */}
      {guestFlow === 'signup' && (
        <div style={{ position: 'absolute', inset: 0, background: color.bg, zIndex: 30 }}>
          <GuestSignupScreen onClose={() => setGuestFlow(null)} onDone={(res) => setGuestFlow({ welcome: true, pendingEmail: !!res?.pendingEmail })} />
        </div>
      )}

      <TabBar active={tab} onChange={changeTab} profile={{ name: user?.name, photoUrl: photoUrlOf(user?.avatarPath) }} guest={guest} />

      {shop && (
        <ShopDetail
          shop={shop.shop}
          from={shop.from}
          onClose={() => setShop(null)}
          onSavedChange={() => setSavedVersion((v) => v + 1)}
          onGuestLocked={openGuestSheet}
        />
      )}

      {guest && (
        <GuestRegisterSheet
          open={guestSheet}
          onClose={() => setGuestSheet(false)}
          onRegister={() => {
            setGuestSheet(false);
            setGuestFlow('signup');
          }}
        />
      )}
      {guestFlow?.welcome && <GuestWelcome pendingEmail={guestFlow.pendingEmail} onClose={() => setGuestFlow(null)} />}

      {diagnosis && (
        <DiagnosisScreen
          initialIntent={diagnosis.intent}
          pendingFriendCode={pendingFriendCode}
          onConsumedPendingCode={() => setPendingFriendCode(null)}
          onClose={() => setDiagnosis(null)}
        />
      )}
    </div>
  );
}

function Root() {
  const { user, loading } = useAuth();
  const [splash, setSplash] = useState(true);
  const [handleDone, setHandleDone] = useState(false);
  const endSplash = useCallback(() => setSplash(false), []);
  // 今までの利用者に、次に開いたとき1度だけ「IDを決めよう」を出す（引き渡し書 §7-1）
  const needsHandlePrompt = !!user && !user.isGuest && !user.handleConfirmed && !user.handlePromptedAt && !handleDone;
  return (
    <>
      {!loading && (user ? (needsHandlePrompt ? <HandlePromptScreen onDone={() => setHandleDone(true)} /> : <Shell />) : <LoginFlow />)}
      {splash && <Splash ready={!loading} onDone={endSplash} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </AuthProvider>
  );
}
