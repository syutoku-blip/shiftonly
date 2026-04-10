window.SHIFT_AUTH = window.SHIFT_AUTH || {};

window.SHIFT_AUTH.saveInterest = async function(productId, productName, status, note) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!user.memberId) {
    return { ok:false, needLogin:true };
  }

  const res = await fetch('/exec?action=addWant', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      memberId: user.memberId,
      name: user.name,
      productId,
      productName,
      status,
      note
    })
  });

  return await res.json();
};

window.SHIFT_AUTH.getWantStatus = async function(productId) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const res = await fetch(`/exec?action=wantStatus&productId=${productId}&memberId=${user.memberId || ''}`);
  return await res.json();
};

window.SHIFT_AUTH.getMyWants = async function() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const res = await fetch(`/exec?action=myWants&memberId=${user.memberId}`);
  return await res.json();
};
