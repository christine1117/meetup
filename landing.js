document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 捲動時淡入 ---------- */
const revealEls = document.querySelectorAll('.reveal');
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach((el) => io.observe(el));
}

/* ---------- Hero：Mutual Reveal 示範 ---------- */
const match = document.querySelector('.match');
if (match) {
  const btn = match.querySelector('.match__btn');
  const status = match.querySelector('.match__status');
  const name = match.querySelector('.match__name');
  const meta = match.querySelector('.match__meta');
  let timer;

  const setState = (state) => {
    match.dataset.state = state;
    if (state === 'hidden') {
      btn.disabled = false;
      btn.textContent = '我想繼續聊';
      status.textContent = '雙方都同意，才會解鎖身份。';
      name.textContent = name.dataset.hidden;
      meta.textContent = '剛聊了 12 分鐘';
    } else if (state === 'waiting') {
      btn.disabled = true;
      btn.textContent = '等對方回覆中';
      status.textContent = '你按了繼續。對方還在考慮。';
    } else {
      btn.disabled = false;
      btn.textContent = '重來一次';
      status.textContent = '對方也想繼續。身份已解鎖。';
      name.textContent = name.dataset.shown;
      meta.textContent = '雙方都同意了';
    }
  };

  btn.addEventListener('click', () => {
    clearTimeout(timer);
    if (match.dataset.state === 'hidden') {
      setState('waiting');
      timer = setTimeout(() => setState('shown'), reduceMotion ? 0 : 1400);
    } else if (match.dataset.state === 'shown') {
      setState('hidden');
    }
  });
}

/* ---------- Build 貼文：匿名申請示範 ---------- */
const post = document.querySelector('.post');
if (post) {
  const btn = post.querySelector('.post__btn');
  btn.addEventListener('click', () => {
    const applied = post.dataset.applied === 'true';
    post.dataset.applied = String(!applied);
    btn.setAttribute('aria-pressed', String(!applied));
  });
}

/* ---------- Drop 倒數 ----------
   時間是暫定的：每週五 13:00 UTC（台北時間 21:00）。
   要改的話改下面兩個數字，還有 index.html 裡的 .drop__when 文字。 */
const DROP_WEEKDAY_UTC = 5; // 0 = 週日
const DROP_HOUR_UTC = 13;

const nextDrop = (now) => {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DROP_HOUR_UTC));
  const daysAhead = (DROP_WEEKDAY_UTC - next.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + daysAhead);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next;
};

const countdown = document.querySelector('.countdown');
if (countdown) {
  const units = {
    d: countdown.querySelector('[data-unit="d"]'),
    h: countdown.querySelector('[data-unit="h"]'),
    m: countdown.querySelector('[data-unit="m"]'),
    s: countdown.querySelector('[data-unit="s"]'),
  };
  const pad = (n) => String(n).padStart(2, '0');

  const tick = () => {
    const now = new Date();
    const total = Math.floor((nextDrop(now) - now) / 1000);
    units.d.textContent = Math.floor(total / 86400);
    units.h.textContent = pad(Math.floor((total % 86400) / 3600));
    units.m.textContent = pad(Math.floor((total % 3600) / 60));
    units.s.textContent = pad(total % 60);
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- 候補名單表單 ----------
   還沒接後端。現在只會檢查 email 格式，然後顯示成功畫面。
   之後要真的收名單，把 TODO 那行換成 fetch 到你的表單服務。 */
const form = document.querySelector('.form');
if (form) {
  const email = form.querySelector('#email');
  const error = form.querySelector('#email-error');
  const done = document.querySelector('.form__done');

  const showError = (show) => {
    error.hidden = !show;
    email.setAttribute('aria-invalid', String(show));
  };

  email.addEventListener('input', () => showError(false));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!email.validity.valid) {
      showError(true);
      email.focus();
      return;
    }
    // TODO: 把 email 送到後端
    form.hidden = true;
    done.hidden = false;
  });
}
