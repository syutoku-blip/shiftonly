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
      const callbackName = '__shiftJsonp_' + Date.now();

      const script = document.createElement('script');
      const sep = url.includes('?') ? '&' : '?';

      window[callbackName] = function (data) {
        delete window[callbackName];
        document.body.removeChild(script);
        resolve(data);
      };

      script.src = url + sep + 'callback=' + callbackName;
      script.onerror = function () {
        reject(new Error('通信エラー'));
      };

      document.body.appendChild(script);
    });
  }

  async function callApi(action, params) {
    const apiBase = getConfig().apiBase;

    const usp = new URLSearchParams({ action });

    Object.entries(params || {}).forEach(([k, v]) => {
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

    if (!res.ok) clearSession();

    return res;
  }

  async function logout() {
    const session = getSession();
    if (session) {
      await callApi('logout', { token: session.sessionToken });
    }
    clearSession();
  }

  async function getProducts() {
    return callApi('getProducts', {});
  }

  async function getProduct(productId) {
    return callApi('getProduct', { productId });
  }

  async function getWantStatus(productId) {
    const session = getSession();

    return callApi('wantStatus', {
      productId,
      token: session?.sessionToken
    });
  }

  async function addWant(productId, productName) {
    const session = getSession();

    if (!session) {
      return { ok: false, needLogin: true };
    }

    return callApi('addWant', {
      token: session.sessionToken,
      productId,
      productName
    });
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

  function getLoginUrl(redirect) {
    return 'login.html?next=' + encodeURIComponent(redirect || location.pathname);
  }

  async function requireAuth(options) {
    const res = await verify();

    if (res.ok) return true;

    if (options && options.redirectTo) {
      const next = encodeURIComponent(location.pathname);
      location.href = options.redirectTo + '?next=' + next;
    }

    return false;
  }

  window.SHIFT_AUTH = {
    register,
    login,
    verify,
    logout,
    getProducts,
    getProduct,
    getWantStatus,
    addWant,
    getMyWants,
    requireAuth,
    getLoginUrl
  };
})();
