/* ぽちっと漢字 — ネイティブ機能の橋渡し (広告 / 課金 / 通知)
 *
 * ブラウザで開いたときは全部ダミー動作になるので、index.html はどちらでも同じコードで動く。
 *
 * ★公開前に差し替える値 → AD_IDS (AdMobの管理画面で発行)
 *   差し替えるまではGoogle公式のテスト広告IDを使う(実収益ゼロ・審査には出さないこと)
 */
(function () {
  'use strict';

  // ---- 広告ユニットID -------------------------------------------------
  // 本番ID(AdMob 2026-09-12 発行)。テストしたいときだけ IS_TESTING を true にする。
  var IS_TESTING = false;
  var AD_IDS = {
    banner: 'ca-app-pub-7792368657314009/1806122369',
    interstitial: 'ca-app-pub-7792368657314009/7856525399',
    rewarded: 'ca-app-pub-7792368657314009/8725919787'
  };
  var PRODUCT_ID = 'pochittokanji_premium'; // 非消耗型 ¥480 広告なし+ヒント無制限

  var C = window.Capacitor;
  var isApp = !!(C && C.isNativePlatform && C.isNativePlatform());
  var AdMob = null, LocalNotifications = null;
  var premium = false;
  var bannerShown = false;
  var interstitialReady = false;
  var log = function () { try { console.log.apply(console, ['[native]'].concat([].slice.call(arguments))); } catch (e) {} };

  try { premium = localStorage.getItem('pk_premium') === '1'; } catch (e) {}

  // ---- ブラウザ用のダミー ---------------------------------------------
  // index.html 側の modal() を使う。まだ定義前でも動くよう遅延参照する。
  function pseudo(title, body, ok, cancel, okLabel) {
    if (typeof window.modal === 'function') window.modal(title, body, ok, cancel, okLabel);
    else if (ok) ok();
  }

  // ---- 初期化 ---------------------------------------------------------
  function init() {
    if (!isApp) { log('browser mode'); return Promise.resolve(); }
    AdMob = C.Plugins.AdMob;
    LocalNotifications = C.Plugins.LocalNotifications;
    // 順番が重要: ATTの許可ダイアログ → AdMob初期化 → 課金初期化
    return requestATT().then(initAds).then(initIAP).catch(function (e) { log('init error', e); });
  }

  /* ---- ATT(トラッキングの許可) --------------------------------------
   * @capacitor-community/admob 7系では initialize() の
   * requestTrackingAuthorization オプションが廃止されている。
   * AdMob.requestTrackingAuthorization() を自分で呼ばないとダイアログは出ない。
   * (1.0(4) がガイドライン2.1で差し戻された原因。2026-09-23)
   *
   * さらに iOS はアプリがアクティブになる前に要求すると、ダイアログを出さずに
   * 黙って拒否する。画面が表示されてから少し待って呼ぶこと。          */
  function whenActive() {
    return new Promise(function (resolve) {
      var done = false;
      var fire = function () {
        if (done) return; done = true;
        document.removeEventListener('visibilitychange', onVis);
        setTimeout(resolve, 800); // スプラッシュが消えてアクティブになるのを待つ
      };
      var onVis = function () { if (document.visibilityState === 'visible') fire(); };
      if (document.visibilityState === 'visible') { fire(); return; }
      document.addEventListener('visibilitychange', onVis);
      setTimeout(fire, 5000); // 保険
    });
  }

  function attStatus() {
    if (!AdMob || !AdMob.trackingAuthorizationStatus) return Promise.resolve(null);
    return AdMob.trackingAuthorizationStatus().catch(function () { return null; });
  }

  function requestATT() {
    if (!AdMob || !AdMob.requestTrackingAuthorization) return Promise.resolve();
    return whenActive()
      .then(attStatus)
      .then(function (r) {
        var st = r && r.status;
        log('ATT status', st);
        if (st && st !== 'notDetermined') return; // 回答済みなら出さない
        return AdMob.requestTrackingAuthorization();
      })
      .then(attStatus)
      .then(function (r) {
        // 要求が届かず未回答のままなら、もう一度だけ出し直す
        if (r && r.status === 'notDetermined') {
          return new Promise(function (res) { setTimeout(res, 2000); })
            .then(function () { return AdMob.requestTrackingAuthorization(); })
            .then(attStatus);
        }
        return r;
      })
      .then(function (r) { log('ATT result', r && r.status); })
      .catch(function (e) { log('ATT error', e); });
  }

  function initAds() {
    if (!AdMob) return Promise.resolve();
    return AdMob.initialize({
      initializeForTesting: IS_TESTING
    }).then(function () {
      log('admob ready');
      if (!premium) prepareInterstitial();
    });
  }

  function prepareInterstitial() {
    if (!AdMob || premium) return;
    AdMob.prepareInterstitial({ adId: AD_IDS.interstitial, isTesting: IS_TESTING })
      .then(function () { interstitialReady = true; })
      .catch(function (e) { interstitialReady = false; log('interstitial prepare failed', e); });
  }

  // ---- 課金 -----------------------------------------------------------
  // GRID HUNTER が審査で却下された原因(商品が取れていない状態で購入シートを出した)を避けるため、
  // 必ず deviceready を待ってから初期化し、購入時に商品が無ければ取り直す。
  var storeReady = false;
  function initIAP() {
    if (!isApp) return Promise.resolve();
    return new Promise(function (resolve) {
      var started = false;
      var start = function () {
        if (started) return; started = true;
        try {
          var CP = window.CdvPurchase;
          if (!CP) { log('CdvPurchase not found'); return resolve(); }
          var store = CP.store;
          store.register([{
            id: PRODUCT_ID,
            type: CP.ProductType.NON_CONSUMABLE,
            platform: CP.Platform.APPLE_APPSTORE
          }]);
          store.when()
            .approved(function (t) { t.verify(); })
            .verified(function (r) { setPremium(true); r.finish(); })
            .receiptUpdated(function () { syncOwnership(); });
          store.error(function (e) { log('store error', e && e.message); });
          store.initialize([CP.Platform.APPLE_APPSTORE]).then(function () {
            storeReady = true; syncOwnership(); resolve();
          });
        } catch (e) { log('iap init error', e); resolve(); }
      };
      document.addEventListener('deviceready', start, { once: true });
      setTimeout(start, 2500); // 保険(deviceready が来ないケース)
    });
  }

  function syncOwnership() {
    try {
      var CP = window.CdvPurchase;
      if (!CP) return;
      var p = CP.store.get(PRODUCT_ID, CP.Platform.APPLE_APPSTORE);
      if (p && p.owned) setPremium(true);
    } catch (e) {}
  }

  function setPremium(v) {
    if (premium === v) return;
    premium = v;
    try { localStorage.setItem('pk_premium', v ? '1' : '0'); } catch (e) {}
    if (v) { banner(false); }
    if (typeof window.onPremiumChanged === 'function') window.onPremiumChanged(v);
  }

  function buyPremium() {
    if (!isApp) { pseudo('アプリ版で購入できます', '広告なし+ヒント無制限 ¥480(買い切り)。ブラウザ版では購入できません。'); return; }
    try {
      var CP = window.CdvPurchase, store = CP.store;
      var p = store.get(PRODUCT_ID, CP.Platform.APPLE_APPSTORE);
      if (!p || !p.getOffer()) {
        // 商品が取れていない → 取り直してから注文(取れなければ購入シートを出さない)
        store.update().then(function () {
          var q = store.get(PRODUCT_ID, CP.Platform.APPLE_APPSTORE);
          if (q && q.getOffer()) q.getOffer().order();
          else pseudo('しばらくしてからお試しください', '商品情報を取得できませんでした。通信環境をご確認ください。');
        });
        return;
      }
      p.getOffer().order();
    } catch (e) { log('buy error', e); }
  }

  function restore() {
    if (!isApp) { pseudo('アプリ版で復元できます', 'ブラウザ版では購入の復元はできません。'); return; }
    try {
      window.CdvPurchase.store.restorePurchases().then(function () {
        syncOwnership();
        pseudo('購入の復元', premium ? '広告なしを復元しました。' : '復元できる購入はありませんでした。');
      });
    } catch (e) { log('restore error', e); }
  }

  // ---- 広告の表示 -----------------------------------------------------
  function banner(show) {
    if (!isApp || !AdMob) return;
    if (premium || !show) {
      if (bannerShown) { AdMob.hideBanner().catch(function () {}); bannerShown = false; }
      return;
    }
    if (bannerShown) return;
    bannerShown = true;
    AdMob.showBanner({
      adId: AD_IDS.banner,
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
      isTesting: IS_TESTING
    }).catch(function (e) { bannerShown = false; log('banner failed', e); });
  }

  // 練習モードの区切りで表示。デイリー中は絶対に呼ばない(体験を守るため)
  function interstitial(then) {
    then = then || function () {};
    if (!isApp || !AdMob || premium || !interstitialReady) { then(); return; }
    interstitialReady = false;
    AdMob.showInterstitial()
      .then(function () { prepareInterstitial(); then(); })
      .catch(function (e) { log('interstitial failed', e); prepareInterstitial(); then(); });
  }

  /* リワード動画。
   * アプリ: 確認ダイアログ → 動画 → 最後まで見たら onReward
   * ブラウザ: 疑似ダイアログでOKなら onReward
   * premium: 広告なしで即 onReward(ヒント無制限の特典)               */
  function rewarded(title, body, onReward, onCancel) {
    onReward = onReward || function () {};
    onCancel = onCancel || function () {};
    if (premium) { onReward(); return; }
    if (!isApp || !AdMob) { pseudo(title, body + '\n(ブラウザ版では広告の代わりにこのダイアログが出ます)', onReward, onCancel, '動画を見る'); return; }
    pseudo(title, body, function () {
      AdMob.prepareRewardVideoAd({ adId: AD_IDS.rewarded, isTesting: IS_TESTING })
        .then(function () { return AdMob.showRewardVideoAd(); })
        .then(function (reward) { if (reward) onReward(); else onCancel(); })
        .catch(function (e) {
          log('rewarded failed', e);
          pseudo('広告を読み込めませんでした', '通信環境をご確認ください。', onCancel, null);
        });
    }, onCancel, '動画を見る');
  }

  // ---- 通知 -----------------------------------------------------------
  var NOTIF_ID = 1;
  function scheduleDaily(hhmm, enabled) {
    if (!isApp || !LocalNotifications) return Promise.resolve();
    var parts = String(hhmm || '08:00').split(':');
    var hour = parseInt(parts[0], 10) || 8, minute = parseInt(parts[1], 10) || 0;
    return LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(function () {}).then(function () {
      if (!enabled) return;
      return LocalNotifications.requestPermissions().then(function (r) {
        if (r.display !== 'granted') return;
        return LocalNotifications.schedule({
          notifications: [{
            id: NOTIF_ID,
            title: 'ぽちっと漢字',
            body: '今日の3問が届きました',
            schedule: { on: { hour: hour, minute: minute }, allowWhileIdle: true }
          }]
        });
      });
    }).catch(function (e) { log('notif error', e); });
  }

  window.Native = {
    isApp: isApp,
    init: init,
    banner: banner,
    interstitial: interstitial,
    rewarded: rewarded,
    buyPremium: buyPremium,
    restore: restore,
    scheduleDaily: scheduleDaily,
    isPremium: function () { return premium; }
  };
})();
