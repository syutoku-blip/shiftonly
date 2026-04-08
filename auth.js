window.SHIFT_AUTH_CONFIG = {
  apiBase: 'https://script.google.com/macros/s/AKfycbwXQMrwBtsByU9n1rT8D4JOuhhTpuSK0GI_znNc6j9WapRHUXSs2RY4f8PEqqTGRuA0dw/exec'
};

(function () {

const STORAGE_KEY = 'shiftSession';

function getSession(){
  return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
}

function setSession(s){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function clearSession(){
  localStorage.removeItem(STORAGE_KEY);
}

function jsonp(url){
  return new Promise((resolve,reject)=>{
    const cb='cb_'+Date.now();
    window[cb]=(data)=>{
      delete window[cb];
      resolve(data);
    };
    const s=document.createElement('script');
    s.src=url+(url.includes('?')?'&':'?')+'callback='+cb;
    s.onerror=reject;
    document.body.appendChild(s);
  });
}

async function callApi(action, params){
  const base = window.SHIFT_AUTH_CONFIG.apiBase;
  const usp = new URLSearchParams({action});
  Object.entries(params||{}).forEach(([k,v])=>usp.set(k,v));
  return jsonp(base+'?'+usp.toString());
}

async function register(memberNo,name){
  const res = await callApi('register',{memberNo,name});
  if(res.ok){
    setSession({
      token:res.sessionToken,
      name:res.name,
      memberNo:res.memberNo
    });
  }
  return res;
}

async function login(memberNo,name){
  const res = await callApi('login',{memberNo,name});
  if(res.ok){
    setSession({
      token:res.sessionToken,
      name:res.name,
      memberNo:res.memberNo
    });
  }
  return res;
}

async function verify(){
  const s=getSession();
  if(!s) return {ok:false};
  return callApi('verify',{token:s.token});
}

async function logout(){
  const s=getSession();
  if(s){
    await callApi('logout',{token:s.token});
  }
  clearSession();
}

window.SHIFT_AUTH = {
  register,
  login,
  verify,
  logout,
  getSession
};

})();
