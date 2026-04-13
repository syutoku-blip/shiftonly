window.SHIFT_AUTH_CONFIG = {
  apiBase: 'https://script.google.com/macros/s/AKfycbwXQMrwBtsByU9n1rT8D4JOuhhTpuSK0GI_znNc6j9WapRHUXSs2RY4f8PEqqTGRuA0dw/exec',
  productJsonBasePath: './',
  productFiles: ['item1.json', 'item2.json', 'item3.json']
};

(function () {
  const STORAGE_KEY = 'shiftMemberSession';
  let catalogCache = null;

  function getConfig() {
    return window.SHIFT_AUTH_CONFIG || {};
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      const callbackName = '__shiftJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      const script = document.createElement('script');
      const sep = url.includes('?') ? '&' : '?';
      let done = false;

      window[callbackName] = function (data) {
        if (done) return;
        done = true;
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        resolve(data);
      };

      script.src = url + sep + 'callback=' + callbackName;
      script.onerror = function () {
        if (done) return;
        done = true;
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        reject(new Error('通信エラー'));
      };

      document.body.appendChild(script);
    });
  }

  async function callApi(action, params) {
    const apiBase = getConfig().apiBase;
    const usp = new URLSearchParams({ action });

    Object.entries(params || {}).forEach(function ([k, v]) {
      if (v !== undefined && v !== null) {
        usp.set(k, v);
      }
    });

    return jsonp(apiBase + '?' + usp.toString());
  }

  async function register(memberNo, name) {
    const res = await callApi('register', { memberNo, name });
    if (res.ok && res.sessionToken) {
      setSession(res);
    }
    return res;
  }

  async function login(memberNo, name) {
    const res = await callApi('login', { memberNo, name });
    if (res.ok && res.sessionToken) {
      setSession(res);
    }
    return res;
  }

  async function verify() {
    const session = getSession();
    if (!session) return { ok: false };

    const res = await callApi('verify', { token: session.sessionToken });
    if (!res.ok) {
      clearSession();
    }
    return res;
  }

  async function logout() {
    const session = getSession();
    if (session) {
      await callApi('logout', { token: session.sessionToken });
    }
    clearSession();
  }

  function getLoginUrl(redirect) {
    return 'login.html?next=' + encodeURIComponent(redirect || (location.pathname + location.search));
  }

  async function requireAuth(options) {
    const res = await verify();

    if (res.ok) return true;

    if (options && options.redirectTo) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = options.redirectTo + '?next=' + next;
    }

    return false;
  }

  function categoryDescription(name) {
    const text = String(name || '');
    if (text.indexOf('文房具') !== -1) return '事務用品からギフト向け筆記具まで、安定した需要を見込めるカテゴリ。';
    if (text.indexOf('化粧品') !== -1 || text.indexOf('コスメ') !== -1) return 'トレンド感のある美容商材を、鮮度高く見せるカテゴリ。';
    if (text.indexOf('雑貨') !== -1) return '売れ筋の定番商品を、比較しやすく一覧化。';
    if (text.indexOf('ギフト') !== -1) return 'イベントや催事でも使いやすい、華やか系商材。';
    if (text.indexOf('食品') !== -1 || text.indexOf('お菓子') !== -1) return 'レジ前やギフト棚でも動かしやすいカテゴリ。';
    return '会員向けに取り扱う商材カテゴリです。';
  }

  function emojiByCategory(name) {
    const text = String(name || '');
    if (text.indexOf('文房具') !== -1) return '🖋️';
    if (text.indexOf('化粧品') !== -1 || text.indexOf('コスメ') !== -1) return '💄';
    if (text.indexOf('食品') !== -1 || text.indexOf('お菓子') !== -1) return '🍵';
    if (text.indexOf('雑貨') !== -1) return '🏠';
    if (text.indexOf('ギフト') !== -1) return '🎁';
    return '📦';
  }

  function normalizeProduct(raw, fileName) {
    const item = Object.assign({}, raw || {});
    item.fileName = fileName || item.fileName || '';
    item.productId = item.productId || fileName || '';
    item.productName = item.productName || item.productId || '';
    item.category = item.category || '';
    item.emoji = item.emoji || emojiByCategory(item.category);
    item.summary =
      item.summary ||
      (item.productInfo && item.productInfo[0] && item.productInfo[0].value) ||
      categoryDescription(item.category);

    if (!Array.isArray(item.wholesaleInfo)) item.wholesaleInfo = [];
    if (!Array.isArray(item.productInfo)) item.productInfo = [];
    if (!Array.isArray(item.expenses)) item.expenses = [];

    return item;
  }

  async function fetchProductFile(fileName) {
    const basePath = getConfig().productJsonBasePath || './';
    const url = basePath.replace(/\/?$/, '/') + encodeURIComponent(String(fileName || ''));

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('商材ファイルの読み込みに失敗しました: ' + fileName);
    }

    const json = await res.json();
    return normalizeProduct(json, fileName);
  }

  async function getCatalog(forceReload) {
    if (catalogCache && !forceReload) {
      return { ok: true, items: catalogCache };
    }

    const files = (getConfig().productFiles || []).slice();
    const results = await Promise.all(
      files.map(async function (fileName) {
        try {
          return await fetchProductFile(fileName);
        } catch (err) {
          console.error(err);
          return null;
        }
      })
    );

    catalogCache = results.filter(Boolean);

    return { ok: true, items: catalogCache };
  }

  async function getProducts() {
    return getCatalog(false);
  }

  async function getProduct(productId) {
    const catalog = await getCatalog(false);
    const key = String(productId || '').trim();

    const item = (catalog.items || []).find(function (p) {
      return String(p.productId || '') === key || String(p.fileName || '') === key;
    });

    if (!item) {
      return { ok: false, message: '商材情報が見つかりません。' };
    }

    return { ok: true, item: item };
  }

  async function getWantStatus(productId) {
    const session = getSession();

    return callApi('wantStatus', {
      productId,
      token: session && session.sessionToken ? session.sessionToken : ''
    });
  }

  async function saveInterest(productId, productName, interestType, note) {
    const session = getSession();

    if (!session) {
      return { ok: false, needLogin: true };
    }

    return callApi('addWant', {
      token: session.sessionToken,
      productId,
      productName,
      interestType,
      note: note || ''
    });
  }

  async function removeInterest(productId, interestType) {
    const session = getSession();

    if (!session) {
      return { ok: false, needLogin: true };
    }

    return callApi('deleteWant', {
      token: session.sessionToken,
      productId,
      interestType
    });
  }

  async function addWant(productId, productName) {
    return saveInterest(productId, productName, 'want', '');
  }

  async function getMyWants() {
    const session = getSession();

    if (!session) {
      return { ok: false, needLogin: true };
    }

    return callApi('myWants', {
      token: session.sessionToken
    });
  }

  async function syncHeaderAuthUI() {
    const loginBtn = document.querySelector('[data-login-btn]');
    const mypageBtn = document.querySelector('[data-mypage-btn]');
    const singleBtn = document.querySelector('[data-auth-button]');

    let res = { ok: false };
    try {
      res = await verify();
    } catch (e) {
      res = { ok: false };
    }

    if (res.ok) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (mypageBtn) mypageBtn.style.display = 'inline-flex';

      if (singleBtn) {
        singleBtn.textContent = 'マイページ';
        singleBtn.href = 'mypage.html';
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (mypageBtn) mypageBtn.style.display = 'none';

      if (singleBtn) {
        singleBtn.textContent = 'ログイン';
        singleBtn.href = getLoginUrl();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncHeaderAuthUI();
  });

  window.SHIFT_AUTH = {
    register,
    login,
    verify,
    logout,
    getCatalog,
    getProducts,
    getProduct,
    getWantStatus,
    saveInterest,
    removeInterest,
    addWant,
    getMyWants,
    requireAuth,
    getLoginUrl,
    syncHeaderAuthUI
  };
})();
