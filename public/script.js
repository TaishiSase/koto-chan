// ===== 設定 =====
var db = null;
const PASSWORD = '20240219';
const AUTH_EXPIRY = 24 * 60 * 60 * 1000;

// ===== Supabase 初期化 =====
async function initSupabase(config) {
  const { createClient } = window.supabase;
  db = createClient(config.supabaseUrl, config.supabaseKey);
}

// ===== 認証 =====
function checkAuth() {
  const authTime = localStorage.getItem('koto_auth_time');
  if (authTime && (Date.now() - parseInt(authTime)) < AUTH_EXPIRY) {
    showMainApp();
  } else {
    localStorage.removeItem('koto_auth_time');
    showAuthScreen();
  }
}

function authenticate() {
  const password = document.getElementById('passwordInput').value;
  const errEl    = document.getElementById('authError');

  if (!password) {
    errEl.textContent = 'パスワードを入力してください';
    return;
  }

  if (password === PASSWORD) {
    errEl.textContent = '';
    localStorage.setItem('koto_auth_time', Date.now().toString());
    showMainApp();
  } else {
    errEl.textContent = 'パスワードが正しくありません';
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordInput').focus();
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById('passwordInput');
  const icon  = document.getElementById('eyeIcon');
  if (input.type === 'password') {
    input.type  = 'text';
    icon.textContent = '🙈';
  } else {
    input.type  = 'password';
    icon.textContent = '👁';
  }
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
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));

  document.getElementById(pageName + 'Page').classList.add('active');
  const btn = document.querySelector('.nav-btn[data-page="' + pageName + '"]');
  if (btn) btn.classList.add('active');

  if (pageName === 'list')           loadAllPhotos();
  else if (pageName === 'favorites') loadFavorites();
  else if (pageName === 'today')     loadTodayPhoto();
}

// ===== 日付ユーティリティ =====
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
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset   = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  return Math.ceil((date.getDate() + offset) / 7);
}

// ===== 季節 =====
function getSeasonColor(dateStr) {
  const month = new Date(dateStr + 'T00:00:00').getMonth() + 1;
  if (month >= 3 && month <= 5)  return { season: 'spring', color: '#FF9EC4', emoji: '🌸', bg: '#FFF5FA' };
  if (month >= 6 && month <= 8)  return { season: 'summer', color: '#4BB8E8', emoji: '☀️',  bg: '#F0F8FF' };
  if (month >= 9 && month <= 11) return { season: 'autumn', color: '#FF9B3A', emoji: '🍂', bg: '#FFF8F0' };
  return                                 { season: 'winter', color: '#7EC8D8', emoji: '❄️',  bg: '#F0F6FF' };
}

// ===== XSS対策 =====
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ===== 今日のページ =====
async function loadTodayPhoto() {
  try {
    const { data } = await db.from('posts').select('*').eq('post_date', getTodayDate()).single();
    const photoEl  = document.getElementById('todayPhoto');
    const infoEl   = document.getElementById('todayInfo');

    if (!data) {
      photoEl.innerHTML        = '<p class="no-photo">📷 未投稿です</p>';
      photoEl.style.borderColor = '';
      infoEl.innerHTML          = '';
      return;
    }

    const s = getSeasonColor(data.post_date);
    photoEl.style.borderColor = s.color;
    photoEl.innerHTML = '<img src="' + data.image_url + '" alt="今日の写真" onclick="showPhotoPopup(\'' + data.image_url + '\')">';

    infoEl.innerHTML =
      '<div class="today-meta">' +
        '<span class="season-badge ' + s.season + '">' + s.emoji + ' ' + formatDate(data.post_date) + '</span>' +
        '<button class="fav-btn' + (data.is_favorite ? ' active' : '') + '" ' +
                'onclick="toggleFavorite(\'' + data.id + '\', ' + data.is_favorite + ', \'today\')">' +
          (data.is_favorite ? '⭐' : '☆') +
        '</button>' +
      '</div>' +
      '<p class="today-comment">' + escapeHtml(data.comment) + '</p>';
  } catch (err) {
    console.error('今日の写真の読み込みエラー:', err);
  }
}

// ===== 一覧ページ =====
async function loadAllPhotos() {
  const container = document.getElementById('photoTimeline');
  container.innerHTML = '<p class="loading">読み込み中…</p>';

  try {
    const { data, error } = await db
      .from('posts').select('*').order('post_date', { ascending: false });
    if (error) throw error;

    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-msg">まだ投稿がありません</p>';
      return;
    }

    let lastMonth = null;
    let lastWeek  = null;

    data.forEach(function(post) {
      const date  = new Date(post.post_date + 'T00:00:00');
      const month = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
      const week  = getWeekNumber(date);
      const s     = getSeasonColor(post.post_date);
      var monthChanged = false;

      if (lastMonth !== null && lastMonth !== month) {
        container.appendChild(makeDivider('month', '📅 ' + month));
        lastWeek     = null;
        monthChanged = true;
      }
      if (lastMonth === null) lastMonth = month;
      else if (monthChanged)  lastMonth = month;

      if (!monthChanged && lastWeek !== null && lastWeek !== week) {
        container.appendChild(makeDivider('week', '第' + week + '週'));
      }
      lastWeek = week;

      container.appendChild(makeCard(post, s));
    });

    enableDragScroll(document.getElementById('timelineContainer'));

  } catch (err) {
    console.error('一覧読み込みエラー:', err);
    container.innerHTML = '<p class="error-msg">読み込みに失敗しました</p>';
  }
}

function makeDivider(type, label) {
  const el = document.createElement('div');
  el.className = 'h-divider ' + type + '-divider';
  el.innerHTML =
    '<span class="h-divider-label">' + label + '</span>' +
    '<div class="h-divider-line"></div>';
  return el;
}

function makeCard(post, s) {
  const card = document.createElement('div');
  card.className    = 'timeline-card ' + s.season;
  card.style.background = s.bg;
  card.innerHTML =
    '<div class="card-header">' +
      '<span class="season-icon">' + s.emoji + '</span>' +
      '<span class="fav-star' + (post.is_favorite ? ' active' : '') + '" ' +
            'onclick="toggleFavorite(\'' + post.id + '\', ' + post.is_favorite + ', \'list\')">' +
        (post.is_favorite ? '⭐' : '☆') +
      '</span>' +
    '</div>' +
    '<div class="timeline-date">' + formatDate(post.post_date) + '</div>' +
    '<img src="' + post.image_url + '" alt="' + escapeHtml(post.comment) + '" ' +
         'class="timeline-image" onclick="showPhotoPopup(\'' + post.image_url + '\')">' +
    '<div class="timeline-comment">' + escapeHtml(post.comment) + '</div>';
  return card;
}

// ===== お気に入りページ =====
async function loadFavorites() {
  const container = document.getElementById('favoritesList');
  container.innerHTML = '<p class="loading">読み込み中…</p>';

  try {
    const { data, error } = await db
      .from('posts').select('*').eq('is_favorite', true).order('post_date', { ascending: false });
    if (error) throw error;

    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-msg" style="text-align:center;padding:40px;">⭐ お気に入りはまだありません</p>';
      return;
    }

    const wrapper  = document.createElement('div');
    wrapper.className = 'timeline-container';
    const timeline = document.createElement('div');
    timeline.className = 'photo-timeline';

    data.forEach(function(post) {
      timeline.appendChild(makeCard(post, getSeasonColor(post.post_date)));
    });

    wrapper.appendChild(timeline);
    container.appendChild(wrapper);
    enableDragScroll(wrapper);
  } catch (err) {
    console.error('お気に入り読み込みエラー:', err);
  }
}

// ===== お気に入り切り替え =====
async function toggleFavorite(postId, currentState, context) {
  try {
    const { error } = await db
      .from('posts')
      .update({ is_favorite: !currentState, updated_at: new Date() })
      .eq('id', postId);
    if (error) throw error;

    if (context === 'today')          loadTodayPhoto();
    else if (context === 'list')      loadAllPhotos();
    else if (context === 'favorites') loadFavorites();
  } catch (err) {
    console.error('お気に入り更新エラー:', err);
  }
}

// ===== 写真ポップアップ =====
function showPhotoPopup(imageUrl) {
  document.getElementById('popupImage').src = imageUrl;
  document.getElementById('photoPopup').classList.add('active');
}

function closePhotoPopup() {
  document.getElementById('photoPopup').classList.remove('active');
  document.getElementById('popupImage').src = '';
}

// ===== HEIC変換 =====
async function convertHEICtoJPG(file) {
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    try {
      const blob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (err) {
      console.error('HEIC変換失敗:', err);
    }
  }
  return file;
}

// ===== 画像アップロード =====
async function uploadPhoto(file) {
  const ext      = file.name.split('.').pop().toLowerCase();
  const fileName = 'public/' + Date.now() + '.' + ext;
  const { error } = await db.storage.from('photos').upload(fileName, file, { upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = db.storage.from('photos').getPublicUrl(fileName);
  return publicUrl;
}

// ===== 古い画像を削除 =====
async function deleteOldPhoto(imageUrl) {
  try {
    const path = imageUrl.split('/photos/')[1];
    if (path) await db.storage.from('photos').remove([path]);
  } catch (err) {
    console.warn('古い画像の削除に失敗（無視）:', err);
  }
}

// ===== ドラッグスクロール =====
function enableDragScroll(el) {
  if (!el) return;
  var isDown = false, startX, scrollLeft;

  el.addEventListener('mousedown', function(e) {
    isDown      = true;
    startX      = e.pageX - el.offsetLeft;
    scrollLeft  = el.scrollLeft;
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('mouseleave', function() { isDown = false; el.style.cursor = 'grab'; });
  el.addEventListener('mouseup',    function() { isDown = false; el.style.cursor = 'grab'; });
  el.addEventListener('mousemove',  function(e) {
    if (!isDown) return;
    e.preventDefault();
    el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX);
  });
}

// ===== 初期化 =====
window.addEventListener('load', async function() {
  // Enter キーでログイン
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
    console.log('Supabase 初期化成功');
  } catch (err) {
    console.error('Supabase 初期化エラー:', err);
  }

  checkAuth();

  // 写真選択時に既存投稿チェック
  document.getElementById('photoInput').addEventListener('change', async function() {
    if (!db) return;
    try {
      const { data } = await db
        .from('posts').select('id').eq('post_date', getTodayDate()).single();
      document.getElementById('overwriteWarning').style.display = data ? 'block' : 'none';
    } catch (e) {}
  });

  // 投稿フォーム
  document.getElementById('postForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn       = e.target.querySelector('[type="submit"]');
    const errEl     = document.getElementById('postError');
    const successEl = document.getElementById('postSuccess');
    btn.disabled    = true;
    btn.textContent = '投稿中…';
    errEl.textContent       = '';
    successEl.style.display = 'none';

    try {
      // db が null なら再接続を試みる
      if (!db) {
        try {
          const res    = await fetch('config.json');
          const config = await res.json();
          await initSupabase(config);
        } catch (e) {}
      }
      if (!db) {
        errEl.textContent = 'データベース接続エラー。ページを再読み込みしてください。';
        return;
      }

      var file = document.getElementById('photoInput').files[0];
      if (!file) { errEl.textContent = '写真を選択してください'; return; }

      const comment = document.getElementById('commentInput').value.trim();
      if (!comment) { errEl.textContent = 'コメントを入力してください'; return; }

      file = await convertHEICtoJPG(file);

      const today = getTodayDate();

      const { data: existing } = await db
        .from('posts').select('image_url').eq('post_date', today).single();

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

      setTimeout(function() {
        successEl.style.display = 'none';
        goToPage('today');
      }, 2000);

    } catch (err) {
      console.error('投稿エラー:', err);
      errEl.textContent = '投稿に失敗しました: ' + err.message;
    } finally {
      btn.disabled    = false;
      btn.textContent = '投稿する';
    }
  });
});

// ポップアップを外側クリックまたはEscで閉じる
document.addEventListener('click', function(e) {
  if (e.target === document.getElementById('photoPopup')) closePhotoPopup();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePhotoPopup();
});
