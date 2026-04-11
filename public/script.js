var db = null;
const PASSWORD    = 'kotoneko';
const AUTH_EXPIRY = 24 * 60 * 60 * 1000;
const BIRTHDAY    = new Date('2024-02-19T00:00:00');

var listViewMode   = 'timeline'; // 'timeline' | 'grid'
var _postMap       = {};         // id → post オブジェクト
var currentPopupId = null;

// ===== Supabase =====
async function initSupabase(config) {
  const { createClient } = window.supabase;
  db = createClient(config.supabaseUrl, config.supabaseKey);
}

// ===== 認証 =====
function checkAuth() {
  const t = localStorage.getItem('koto_auth_time');
  if (t && (Date.now() - parseInt(t)) < AUTH_EXPIRY) showMainApp();
  else { localStorage.removeItem('koto_auth_time'); showAuthScreen(); }
}

function authenticate() {
  const pw    = document.getElementById('passwordInput').value;
  const errEl = document.getElementById('authError');
  if (!pw)            { errEl.textContent = 'パスワードを入力してください'; return; }
  if (pw === PASSWORD) {
    errEl.textContent = '';
    localStorage.setItem('koto_auth_time', Date.now().toString());
    showMainApp();
  } else {
    errEl.textContent = 'パスワードが正しくありません';
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordInput').focus();
    const card = document.getElementById('authScreen').querySelector('.auth-card');
    card.style.animation = 'none';
    setTimeout(function() { card.style.animation = 'authShake 0.4s ease'; }, 10);
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById('passwordInput');
  const icon  = document.getElementById('eyeIcon');
  if (input.type === 'password') { input.type = 'text';     icon.textContent = '🙈'; }
  else                           { input.type = 'password'; icon.textContent = '👁'; }
}

function logout() {
  localStorage.removeItem('koto_auth_time');
  location.reload();
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.add('active');
  document.getElementById('mainApp').classList.remove('active');
}

function showMainApp() {
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainApp').classList.add('active');
  goToPage('today');
}

// ===== ページ遷移 =====
function goToPage(pageName) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.bnav-btn').forEach(function(b) { b.classList.remove('active'); });

  document.getElementById(pageName + 'Page').classList.add('active');
  const btn = document.querySelector('.bnav-btn[data-page="' + pageName + '"]');
  if (btn) btn.classList.add('active');

  if (pageName === 'list')           loadAllPhotos();
  else if (pageName === 'favorites') loadFavorites();
  else if (pageName === 'today')     loadTodayPhoto();
}

// ===== 日付・季節 =====
function getTodayDate() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function getWeekNumber(date) {
  const first  = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  return Math.ceil((date.getDate() + offset) / 7);
}

function getSeason(dateStr) {
  const m = new Date(dateStr + 'T00:00:00').getMonth() + 1;
  if (m >= 3 && m <= 5)  return { name: 'spring', color: '#FF8FAB', emoji: '🌸', bg: '#FFF0F5' };
  if (m >= 6 && m <= 8)  return { name: 'summer', color: '#45B7D1', emoji: '☀️',  bg: '#EEF8FF' };
  if (m >= 9 && m <= 11) return { name: 'autumn', color: '#FF8C42', emoji: '🍂', bg: '#FFF5EE' };
  return                         { name: 'winter', color: '#7EB8D4', emoji: '❄️',  bg: '#EEF6FF' };
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ===== 年齢計算 =====
function getAge(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let years  = d.getFullYear() - BIRTHDAY.getFullYear();
  let months = d.getMonth()    - BIRTHDAY.getMonth();
  if (months < 0) { years--; months += 12; }
  return { years: years, months: months, total: years * 12 + months };
}

function getAgeStr(dateStr) {
  const a = getAge(dateStr);
  if (a.years === 0 && a.months === 0) return '生後すぐ';
  if (a.years === 0) return a.months + 'ヶ月';
  if (a.months === 0) return a.years + '歳';
  return a.years + '歳' + a.months + 'ヶ月';
}

// 19日チェック：マイルストーン返す（月次・年次）
function getMilestone(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getDate() !== 19) return null;
  const a = getAge(dateStr);
  if (a.total === 0) return null;
  if (d.getMonth() === 1 && a.months === 0 && a.years > 0) {
    return { type: 'yearly', label: a.years + '歳のお誕生日！🎂', emoji: '🎂' };
  }
  return { type: 'monthly', label: a.total + 'ヶ月の記念日 🎀', emoji: '🎀' };
}

// ===== 連続記録 =====
function calcStreak(postDates) {
  if (!postDates || postDates.length === 0) return 0;
  const dateSet = new Set(postDates);
  const today = getTodayDate();
  const cur = new Date(today + 'T00:00:00');
  // 今日未投稿なら昨日から数える
  if (!dateSet.has(today)) cur.setDate(cur.getDate() - 1);
  let streak = 0;
  while (true) {
    const s = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
    if (dateSet.has(s)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ===== 今日のページ =====
async function loadTodayPhoto() {
  const photoEl  = document.getElementById('todayPhoto');
  const infoEl   = document.getElementById('todayInfo');
  const streakEl = document.getElementById('streakBanner');
  const otdEl    = document.getElementById('onThisDay');

  // 初期化
  streakEl.style.display = 'none';
  otdEl.style.display    = 'none';

  try {
    const { data } = await db.from('posts').select('*').eq('post_date', getTodayDate()).single();
    if (!data) {
      photoEl.innerHTML         = '<p class="no-photo">📷<br>未投稿です</p>';
      photoEl.style.borderColor = '';
      infoEl.innerHTML          = '';
    } else {
      _postMap[data.id] = data;
      const s         = getSeason(data.post_date);
      const milestone = getMilestone(data.post_date);
      const ageStr    = getAgeStr(data.post_date);

      photoEl.style.borderColor = milestone
        ? (milestone.type === 'yearly' ? '#FFD700' : '#FFAACC')
        : s.color;
      photoEl.innerHTML =
        '<img src="' + data.image_url + '" alt="今日の写真" onclick="showPhotoPopup(\'' + data.id + '\')">';

      infoEl.innerHTML =
        (milestone ? '<div class="today-milestone-banner">' + milestone.emoji + ' ' + milestone.label + '</div>' : '') +
        '<div class="today-meta">' +
          '<span class="season-badge">' + s.emoji + ' ' + formatDate(data.post_date) + '</span>' +
          '<div class="today-meta-right">' +
            '<span class="age-badge-today">' + ageStr + '</span>' +
            '<button class="fav-btn" onclick="toggleFavorite(\'' + data.id + '\', ' + data.is_favorite + ', \'today\')">' +
              (data.is_favorite ? '⭐' : '☆') +
            '</button>' +
          '</div>' +
        '</div>' +
        '<p class="today-comment">' + esc(data.comment) + '</p>' +
        '<button class="line-share-btn" onclick="shareTodayToLine()">🟢 LINEでシェア</button>';
    }
  } catch (err) {
    console.error('今日の写真エラー:', err);
  }

  // ストリーク & 過去の今日（並行取得）
  loadTodayExtras();
}

async function loadTodayExtras() {
  const streakEl = document.getElementById('streakBanner');
  const otdEl    = document.getElementById('onThisDay');
  try {
    const { data } = await db.from('posts').select('*').order('post_date', { ascending: false });
    if (!data || data.length === 0) return;

    data.forEach(function(p) { _postMap[p.id] = p; });

    // ストリーク
    const streak = calcStreak(data.map(function(p) { return p.post_date; }));
    if (streak >= 2) {
      streakEl.innerHTML =
        '<span class="streak-flame">🔥</span>' +
        '<span class="streak-count">' + streak + '日</span>' +
        '<span class="streak-label">連続投稿中！</span>';
      streakEl.style.display = 'flex';
    }

    // 過去の今日
    const today = new Date(getTodayDate() + 'T00:00:00');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = getTodayDate();
    const sameDayPosts = data.filter(function(p) {
      return p.post_date !== todayStr && p.post_date.slice(5) === mm + '-' + dd;
    });

    if (sameDayPosts.length === 0) return;

    otdEl.style.display = 'block';
    otdEl.innerHTML = '<h3 class="otd-title">📅 過去の今日</h3>';
    sameDayPosts.forEach(function(post) {
      const d = new Date(post.post_date + 'T00:00:00');
      const item = document.createElement('div');
      item.className = 'otd-item';
      item.innerHTML =
        '<img src="' + post.image_url + '" class="otd-img" onclick="showPhotoPopup(\'' + post.id + '\')">' +
        '<div class="otd-info">' +
          '<div class="otd-year">' + d.getFullYear() + '年</div>' +
          '<div class="otd-age">' + getAgeStr(post.post_date) + '</div>' +
          '<div class="otd-comment">' + esc(post.comment) + '</div>' +
        '</div>';
      otdEl.appendChild(item);
    });
  } catch(e) { /* サイレント失敗 */ }
}

function shareTodayToLine() {
  const todayStr = getTodayDate();
  var post = null;
  Object.values(_postMap).forEach(function(p) { if (p.post_date === todayStr) post = p; });
  if (!post) return;
  const text = '今日のことちゃん ✨\n' + formatDate(post.post_date) + '\n「' + post.comment + '」\n' + post.image_url;
  window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank');
}

// ===== スケルトン =====
function renderSkeletons(container, count) {
  container.innerHTML = '';
  for (var i = 0; i < count; i++) {
    container.innerHTML +=
      '<div class="skeleton-card">' +
        '<div class="skeleton-img"></div>' +
        '<div class="skeleton-line"></div>' +
        '<div class="skeleton-line short"></div>' +
      '</div>';
  }
}

// ===== 一覧ページ =====
async function loadAllPhotos() {
  if (listViewMode === 'grid') { await loadGridView(); return; }

  const container = document.getElementById('photoTimeline');
  document.getElementById('timelineContainer').style.display = '';
  document.getElementById('gridContainer').style.display = 'none';
  document.getElementById('listHint').style.display = '';
  renderSkeletons(container, 5);

  try {
    const { data, error } = await db.from('posts').select('*').order('post_date', { ascending: false });
    if (error) throw error;
    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-msg">まだ投稿がありません 📷</p>';
      return;
    }

    var lastMonth = null, lastWeek = null;

    data.forEach(function(post, idx) {
      _postMap[post.id] = post;
      const date  = new Date(post.post_date + 'T00:00:00');
      const month = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
      const week  = getWeekNumber(date);
      const s     = getSeason(post.post_date);
      var monthChanged = false;

      if (lastMonth !== null && lastMonth !== month) {
        container.appendChild(makeDivider('month', '📅 ' + month));
        lastWeek = null; monthChanged = true;
      }
      if (lastMonth === null) lastMonth = month;
      else if (monthChanged)  lastMonth = month;

      if (!monthChanged && lastWeek !== null && lastWeek !== week) {
        container.appendChild(makeDivider('week', '第' + week + '週'));
      }
      lastWeek = week;

      const card = makeCard(post, s);
      card.style.animationDelay = Math.min(idx, 12) * 60 + 'ms';
      container.appendChild(card);
    });

    requestAnimationFrame(function() {
      container.querySelectorAll('.timeline-card').forEach(function(c) {
        c.classList.add('visible');
      });
    });

    enableDragScroll(document.getElementById('timelineContainer'));

  } catch (err) {
    console.error('一覧エラー:', err);
    container.innerHTML = '<p class="error-msg-inline">読み込みに失敗しました</p>';
  }
}

// ===== グリッドビュー =====
async function loadGridView() {
  const container = document.getElementById('gridContainer');
  document.getElementById('timelineContainer').style.display = 'none';
  document.getElementById('gridContainer').style.display = '';
  document.getElementById('listHint').style.display = 'none';
  container.innerHTML = '<p style="padding:20px;color:var(--muted);font-size:14px;">読み込み中…</p>';

  try {
    const { data, error } = await db.from('posts').select('*').order('post_date', { ascending: false });
    if (error) throw error;
    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-msg">まだ投稿がありません 📷</p>';
      return;
    }

    data.forEach(function(p) { _postMap[p.id] = p; });
    renderGridView(data);

  } catch (err) {
    container.innerHTML = '<p class="error-msg-inline">読み込みに失敗しました</p>';
  }
}

function renderGridView(data) {
  const container = document.getElementById('gridContainer');
  container.innerHTML = '';

  // 年月ごとにグループ化
  var groups = {}, groupOrder = [];
  data.forEach(function(post) {
    const d   = new Date(post.post_date + 'T00:00:00');
    const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
    groups[key].push(post);
  });

  groupOrder.forEach(function(month) {
    const section = document.createElement('div');
    section.className = 'grid-month-section';

    const label = document.createElement('h3');
    label.className = 'grid-month-label';
    label.textContent = month;
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'photo-grid';

    groups[month].forEach(function(post) {
      const item = document.createElement('div');
      const milestone = getMilestone(post.post_date);
      item.className = 'grid-item' + (milestone ? ' grid-item-milestone' : '');

      const d = new Date(post.post_date + 'T00:00:00');
      item.innerHTML =
        '<img src="' + post.image_url + '" alt="' + esc(post.comment) + '" onclick="showPhotoPopup(\'' + post.id + '\')">' +
        '<div class="grid-item-date">' + d.getDate() + '日</div>' +
        (milestone ? '<div class="grid-item-milestone-badge">' + milestone.emoji + '</div>' : '');
      grid.appendChild(item);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

function toggleListView() {
  listViewMode = listViewMode === 'timeline' ? 'grid' : 'timeline';
  const btn = document.getElementById('viewToggleBtn');
  if (listViewMode === 'grid') {
    btn.textContent = '📜 タイムライン';
  } else {
    btn.textContent = '📅 月別グリッド';
  }
  loadAllPhotos();
}

function makeDivider(type, label) {
  const el = document.createElement('div');
  el.className = 'h-divider ' + type + '-divider';
  el.innerHTML = '<span class="h-divider-label">' + label + '</span><div class="h-divider-line"></div>';
  return el;
}

function makeCard(post, s) {
  const card      = document.createElement('div');
  const milestone = getMilestone(post.post_date);
  const ageStr    = getAgeStr(post.post_date);
  card.className  = 'timeline-card ' + s.name + (milestone ? ' milestone-card' : '');
  card.innerHTML =
    (milestone ? '<div class="milestone-banner">' + milestone.label + '</div>' : '') +
    '<div class="card-header">' +
      '<span class="season-icon">' + s.emoji + '</span>' +
      '<span class="age-badge">' + ageStr + '</span>' +
      '<span class="fav-star" onclick="toggleFavorite(\'' + post.id + '\', ' + post.is_favorite + ', \'list\')">' +
        (post.is_favorite ? '⭐' : '☆') +
      '</span>' +
    '</div>' +
    '<div class="timeline-date">' + formatDate(post.post_date) + '</div>' +
    '<img src="' + post.image_url + '" alt="' + esc(post.comment) + '" class="timeline-image" onclick="showPhotoPopup(\'' + post.id + '\')">' +
    '<div class="timeline-comment">' + esc(post.comment) + '</div>';
  return card;
}

// ===== お気に入りページ =====
async function loadFavorites() {
  const container = document.getElementById('favoritesList');
  container.innerHTML = '';
  const wrapper  = document.createElement('div');
  const tWrapper = document.createElement('div');
  tWrapper.className = 'timeline-container';
  const timeline = document.createElement('div');
  timeline.className = 'photo-timeline';

  renderSkeletons(timeline, 3);
  tWrapper.appendChild(timeline);
  wrapper.appendChild(tWrapper);
  container.appendChild(wrapper);

  try {
    const { data, error } = await db.from('posts').select('*').eq('is_favorite', true).order('post_date', { ascending: false });
    if (error) throw error;

    timeline.innerHTML = '';
    if (!data || data.length === 0) {
      timeline.innerHTML = '<p class="empty-msg">⭐ お気に入りはまだありません</p>';
      return;
    }
    data.forEach(function(post, idx) {
      _postMap[post.id] = post;
      const card = makeCard(post, getSeason(post.post_date));
      card.style.animationDelay = Math.min(idx, 12) * 60 + 'ms';
      timeline.appendChild(card);
    });
    requestAnimationFrame(function() {
      timeline.querySelectorAll('.timeline-card').forEach(function(c) {
        c.classList.add('visible');
      });
    });
    enableDragScroll(tWrapper);
  } catch (err) {
    console.error('お気に入りエラー:', err);
  }
}

// ===== お気に入り切り替え =====
async function toggleFavorite(postId, current, ctx) {
  try {
    const { error } = await db.from('posts')
      .update({ is_favorite: !current, updated_at: new Date() }).eq('id', postId);
    if (error) throw error;

    var stars = document.querySelectorAll('.fav-star, .fav-btn');
    stars.forEach(function(el) {
      if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(postId)) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
    });

    if (ctx === 'today')          loadTodayPhoto();
    else if (ctx === 'list')      loadAllPhotos();
    else if (ctx === 'favorites') loadFavorites();
  } catch (err) {
    console.error('お気に入りエラー:', err);
  }
}

// ===== 写真ポップアップ =====
function showPhotoPopup(postId) {
  const post = _postMap[postId];
  if (!post) return;
  currentPopupId = postId;
  document.getElementById('popupImage').src = post.image_url;
  document.getElementById('photoPopup').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePhotoPopup() {
  document.getElementById('photoPopup').classList.remove('active');
  document.getElementById('popupImage').src = '';
  document.body.style.overflow = '';
  currentPopupId = null;
}

function sharePopupToLine() {
  const post = _postMap[currentPopupId];
  if (!post) return;
  const text = '今日のことちゃん ✨\n' + formatDate(post.post_date) + '\n「' + post.comment + '」\n' + post.image_url;
  window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank');
}

// ===== スワイプで閉じる（縦スワイプ） =====
(function() {
  var startY = 0;
  document.getElementById('photoPopup').addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.getElementById('photoPopup').addEventListener('touchend', function(e) {
    if (Math.abs(e.changedTouches[0].clientY - startY) > 80) closePhotoPopup();
  }, { passive: true });
})();

// ===== 画像圧縮（Canvas, max 1920px, 85% JPEG） =====
async function compressImage(file) {
  return new Promise(function(resolve) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
      const MAX = 1920;
      var w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(function(blob) {
        const name = file.name.replace(/\.[^.]+$/, '.jpg');
        resolve(new File([blob], name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ===== HEIC変換 =====
async function convertHEIC(file) {
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    try {
      const blob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (e) { console.error('HEIC変換失敗', e); }
  }
  return file;
}

// ===== アップロード =====
async function uploadPhoto(file) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = 'public/' + Date.now() + '.' + ext;
  const { error } = await db.storage.from('photos').upload(path, file, { upsert: false });
  if (error) throw error;
  return db.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

async function deleteOldPhoto(url) {
  try {
    const path = url.split('/photos/')[1];
    if (path) await db.storage.from('photos').remove([path]);
  } catch (e) { console.warn('旧画像削除失敗（無視）', e); }
}

// ===== ドラッグスクロール =====
function enableDragScroll(el) {
  if (!el) return;
  var down = false, sx, sl;
  el.addEventListener('mousedown',  function(e) { down = true; sx = e.pageX - el.offsetLeft; sl = el.scrollLeft; el.style.cursor = 'grabbing'; });
  el.addEventListener('mouseleave', function()  { down = false; el.style.cursor = 'grab'; });
  el.addEventListener('mouseup',    function()  { down = false; el.style.cursor = 'grab'; });
  el.addEventListener('mousemove',  function(e) { if (!down) return; e.preventDefault(); el.scrollLeft = sl - (e.pageX - el.offsetLeft - sx); });
}

// ===== 写真プレビュー =====
function updatePhotoPreview(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('previewImage').src = e.target.result;
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('fileDropContent').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ===== 初期化 =====
window.addEventListener('load', async function() {

  // Enter でログイン
  document.getElementById('passwordInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') authenticate();
  });

  // 文字数カウント
  document.getElementById('commentInput').addEventListener('input', function(e) {
    document.getElementById('charCount').textContent = e.target.value.length;
  });

  // Supabase 初期化
  try {
    const res    = await fetch('config.json');
    const config = await res.json();
    await initSupabase(config);
  } catch (err) {
    console.error('Supabase初期化エラー:', err);
  }

  checkAuth();

  // 写真選択 → プレビュー & 上書き確認
  document.getElementById('photoInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    updatePhotoPreview(file);
    if (!db) return;
    try {
      const { data } = await db.from('posts').select('id').eq('post_date', getTodayDate()).single();
      document.getElementById('overwriteWarning').style.display = data ? 'block' : 'none';
    } catch (_) {}
  });

  // 投稿フォーム
  document.getElementById('postForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn       = e.target.querySelector('[type="submit"]');
    const errEl     = document.getElementById('postError');
    const successEl = document.getElementById('postSuccess');
    btn.disabled    = true;
    btn.textContent = '投稿中… ✨';
    errEl.textContent       = '';
    successEl.style.display = 'none';

    try {
      // db 再接続
      if (!db) {
        try {
          const r = await fetch('config.json');
          const c = await r.json();
          await initSupabase(c);
        } catch (_) {}
      }
      if (!db) { errEl.textContent = 'データベース接続エラー。ページを再読み込みしてください。'; return; }

      var file = document.getElementById('photoInput').files[0];
      if (!file) { errEl.textContent = '写真を選択してください'; return; }

      const comment = document.getElementById('commentInput').value.trim();
      if (!comment) { errEl.textContent = 'コメントを入力してください'; return; }

      // HEIC変換 → Canvas圧縮
      file = await convertHEIC(file);
      file = await compressImage(file);

      const today = getTodayDate();
      const { data: existing } = await db.from('posts').select('image_url').eq('post_date', today).single();
      const imageUrl = await uploadPhoto(file);

      const { error } = await db.from('posts').upsert(
        { post_date: today, image_url: imageUrl, comment: comment, is_favorite: false, updated_at: new Date() },
        { onConflict: 'post_date' }
      );
      if (error) throw error;

      if (existing && existing.image_url) await deleteOldPhoto(existing.image_url);

      successEl.style.display = 'block';
      document.getElementById('postForm').reset();
      document.getElementById('charCount').textContent = '0';
      document.getElementById('overwriteWarning').style.display = 'none';
      document.getElementById('photoPreview').style.display = 'none';
      document.getElementById('fileDropContent').style.display = 'flex';

      setTimeout(function() {
        successEl.style.display = 'none';
        goToPage('today');
      }, 2000);

    } catch (err) {
      console.error('投稿エラー:', err);
      errEl.textContent = '投稿に失敗しました: ' + err.message;
    } finally {
      btn.disabled    = false;
      btn.textContent = '投稿する ✨';
    }
  });
});

// ポップアップを外側クリック / Esc で閉じる
document.addEventListener('click', function(e) {
  if (e.target === document.getElementById('photoPopup')) closePhotoPopup();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePhotoPopup();
});
