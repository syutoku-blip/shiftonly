window.SHIFT_AUTH_CONFIG = {
  apiBase: 'https://script.google.com/macros/s/AKfycbwXQMrwBtsByU9n1rT8D4JOuhhTpuSK0GI_znNc6j9WapRHUXSs2RY4f8PEqqTGRuA0dw/exec'
};

(function () {
  const STORAGE_KEY = 'shiftMemberSession';

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
      const callbackName = '__shiftJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const script = document.createElement('script');
      const sep = url.includes('?') ? '&' : '?';

      const timeout = setTimeout(function () {
        cleanup();
        reject(new Error('認証サーバーが応答しませんでした。'));
      }, 10000);

      function cleanup() {
        clearTimeout(timeout);
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        try {
          delete window[callbackName];
        } catch (e) {
          window[callbackName] = undefined;
        }
      }

      window[callbackName] = function (data) {
        cleanup();
        resolve(data);
      };

      script.src = url + sep + 'callback=' + encodeURIComponent(callbackName);

      script.onerror = function () {
        cleanup();
        reject(new Error('認証サーバーとの通信に失敗しました。'));
      };

      document.body.appendChild(script);
    });
  }

  async function callApi(action, params) {
    const apiBase = getConfig().apiBase;

    if (!apiBase || apiBase === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
      throw new Error('Apps Script のURLが未設定です。auth.js の apiBase を設定してください。');
    }

    const usp = new URLSearchParams({ action: action });

    Object.entries(params || {}).forEach(function ([key, value]) {
      if (value !== undefined && value !== null) {
        usp.set(key, value);
      }
    });

    return jsonp(apiBase + '?' + usp.toString());
  }

  async function register(memberNo, name) {
    const res = await callApi('register', { memberNo: memberNo, name: name });

    if (res && res.ok && res.sessionToken) {
      setSession({
        token: res.sessionToken,
        memberNo: res.memberNo,
        name: res.name,
        expiresAt: res.expiresAt
      });
    }

    return res;
  }

  async function login(memberNo, name) {
    const res = await callApi('login', { memberNo: memberNo, name: name });

    if (res && res.ok && res.sessionToken) {
      setSession({
        token: res.sessionToken,
        memberNo: res.memberNo,
        name: res.name,
        expiresAt: res.expiresAt
      });
    }

    return res;
  }

  async function verify() {
    const session = getSession();

    if (!session || !session.token) {
      return { ok: false, reason: 'no_session' };
    }

    const res = await callApi('verify', { token: session.token });

    if (!res.ok) {
      clearSession();
    }

    return res;
  }

  async function logout() {
    const session = getSession();

    if (session && session.token) {
      try {
        await callApi('logout', { token: session.token });
      } catch (e) {}
    }

    clearSession();
  }

  async function requireAuth(options) {
    const opts = options || {};
    const gate = document.querySelector('[data-auth-gate]');
    const protectedBody = document.querySelector('[data-protected-body]');

    if (gate) {
      gate.hidden = false;
    }
    if (protectedBody) {
      protectedBody.hidden = true;
    }

    try {
      const res = await verify();

      if (res.ok) {
        if (gate) {
          gate.hidden = true;
        }
        if (protectedBody) {
          protectedBody.hidden = false;
        }
        fillMemberUi(res);
        updateHeaderAuthButtons(true);
        return true;
      }
    } catch (e) {
      console.error(e);
    }

    updateHeaderAuthButtons(false);

    if (opts.redirectTo) {
      const next = encodeURIComponent(location.pathname.split('/').pop() + location.hash);
      location.href = opts.redirectTo + '?next=' + next;
      return false;
    }

    return false;
  }

  async function getWantStatus(productId) {
    const session = getSession();
    const params = { productId: productId };

    if (session && session.token) {
      params.token = session.token;
    }

    return callApi('wantStatus', params);
  }

  async function addWant(productId, productName) {
    const session = getSession();

    if (!session || !session.token) {
      return { ok: false, message: 'ログインしてください。', needLogin: true };
    }

    return callApi('addWant', {
      token: session.token,
      productId: productId,
      productName: productName
    });
  }

  async function getMyWants() {
    const session = getSession();

    if (!session || !session.token) {
      return { ok: false, message: 'ログインしてください。', needLogin: true };
    }

    return callApi('myWants', {
      token: session.token
    });
  }

  async function getProducts() {
    return callApi('getProducts', {});
  }

  async function getProduct(productId) {
    return callApi('getProduct', { productId: productId });
  }

  function fillMemberUi(res) {
    document.querySelectorAll('[data-member-name]').forEach(function (el) {
      el.textContent = res.name || '';
    });

    document.querySelectorAll('[data-member-no]').forEach(function (el) {
      el.textContent = res.memberNo || '';
    });
  }

  function updateHeaderAuthButtons(isLoggedIn) {
    const loginBtns = document.querySelectorAll('[data-login-btn]');
    const mypageBtns = document.querySelectorAll('[data-mypage-btn]');

    loginBtns.forEach(function (el) {
      el.style.display = isLoggedIn ? 'none' : '';
    });

    mypageBtns.forEach(function (el) {
      el.style.display = isLoggedIn ? '' : 'none';
    });
  }

  async function syncHeaderAuthButtons() {
    try {
      const res = await verify();
      updateHeaderAuthButtons(!!res.ok);
    } catch (e) {
      updateHeaderAuthButtons(false);
    }
  }

  window.SHIFT_AUTH = {
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    register: register,
    login: login,
    verify: verify,
    logout: logout,
    requireAuth: requireAuth,
    getWantStatus: getWantStatus,
    addWant: addWant,
    getMyWants: getMyWants,
    getProducts: getProducts,
    getProduct: getProduct,
    syncHeaderAuthButtons: syncHeaderAuthButtons
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncHeaderAuthButtons);
  } else {
    syncHeaderAuthButtons();
  }
})();
