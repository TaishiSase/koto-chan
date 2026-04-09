// Supabase Configuration
let supabase = null;
const PASSWORD = 'ことねこ';
const AUTH_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Initialize Supabase (will be set from config.json)
async function initSupabase(config) {
  const { createClient } = window.supabase;
  supabase = createClient(config.supabaseUrl, config.supabaseKey);
}

// Check Auth State
function checkAuth() {
  const authTime = localStorage.getItem('koto_auth_time');
  const now = Date.now();
  
  if (authTime && (now - parseInt(authTime)) < AUTH_EXPIRY) {
    showMainApp();
  } else {
    localStorage.removeItem('koto_auth_time');
    showAuthScreen();
  }
}

function authenticate() {
  const password = document.getElementById('passwordInput').value;
  if (password === PASSWORD) {
    localStorage.setItem('koto_auth_time', Date.now().toString());
    showMainApp();
  } else {
    document.getElementById('authError').textContent = 'パスワードが正しくありません';
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
  loadTodayPhoto();
}

// Page Navigation
function goToPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageName + 'Page').classList.add('active');
  
  if (pageName === 'list') {
    loadAllPhotos();
  } else if (pageName === 'favorites') {
    loadFavorites();
  } else if (pageName === 'today') {
    loadTodayPhoto();
  }
}

// Get Today's Date
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  return date.toLocaleDateString('ja-JP', options);
}

function getSeasonColor(dateStr) {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  
  if (month >= 3 && month <= 5) return { color: '#FFB6E1', season: '春', emoji: '🌸' };
  if (month >= 6 && month <= 8) return { color: '#87CEEB', season: '夏', emoji: '☀️' };
  if (month >= 9 && month <= 11) return { color: '#FFB347', season: '秋', emoji: '🍂' };
  return { color: '#B0E0E6', season: '冬', emoji: '❄️' };
}

// Load Today's Photo
async function loadTodayPhoto() {
  try {
    const today = getTodayDate();
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('post_date', today)
      .single();
    
    const container = document.getElementById('todayPhoto');
    const infoContainer = document.getElementById('todayInfo');
    
    if (error || !data) {
      container.innerHTML = '<p class="no-photo">未投稿です</p>';
      infoContainer.innerHTML = '';
    } else {
      container.innerHTML = `<img src="${data.image_url}" alt="Today photo" style="max-width: 100%; border-radius: 10px;">`;
      const season = getSeasonColor(data.post_date);
      infoContainer.innerHTML = `
        <p style="font-size: 14px; color: #666;">
          <span class="season-dot" style="background: ${season.color};"></span>
          ${formatDate(data.post_date)}
        </p>
        <p style="font-size: 14px; margin-top: 10px;">${data.comment}</p>
        <button onclick="toggleFavorite('${data.id}', ${data.is_favorite})" style="margin-top: 15px; padding: 8px 16px; border: none; background: ${data.is_favorite ? 'gold' : '#ddd'}; border-radius: 10px; cursor: pointer; font-size: 16px;">
          ${data.is_favorite ? '⭐ お気に入り済み' : '☆ お気に入りに追加'}
        </button>
      `;
    }
  } catch (err) {
    console.error('Error loading today photo:', err);
  }
}

// Load All Photos
async function loadAllPhotos() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('post_date', { ascending: false });
    
    if (error) throw error;
    
    const container = document.getElementById('photoTimeline');
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="padding: 20px; color: #999;">まだ投稿がありません</p>';
      return;
    }
    
    let lastMonth = null;
    let lastWeek = null;
    
    data.forEach(post => {
      const date = new Date(post.post_date);
      const month = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
      const week = Math.ceil((date.getDate()) / 7);
      
      // Month divider
      if (lastMonth !== month) {
        const divider = document.createElement('div');
        divider.className = 'section-divider';
        divider.innerHTML = `
          <div class="divider-line"></div>
          <div class="divider-label">📅 ${month}</div>
        `;
        container.appendChild(divider);
        lastMonth = month;
      }
      
      // Week divider
      if (lastWeek !== week) {
        const weekDivider = document.createElement('div');
        weekDivider.className = 'section-divider';
        weekDivider.style.margin = '15px 0';
        weekDivider.innerHTML = `<div class="divider-label">第${week}週</div>`;
        container.appendChild(weekDivider);
        lastWeek = week;
      }
      
      const season = getSeasonColor(post.post_date);
      const card = document.createElement('div');
      card.className = `timeline-card ${post.is_favorite ? 'favorite' : ''}`;
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="season-dot" style="background: ${season.color}; margin: 0;"></span>
          <span class="favorite-star" onclick="toggleFavorite('${post.id}', ${post.is_favorite})" style="cursor: pointer;">
            ${post.is_favorite ? '⭐' : '☆'}
          </span>
        </div>
        <div class="timeline-date">${formatDate(post.post_date)}</div>
        <img src="${post.image_url}" alt="${post.comment}" class="timeline-image" onclick="showPhotoPopup('${post.image_url}')">
        <div class="timeline-comment">${post.comment}</div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading photos:', err);
  }
}

// Load Favorites
async function loadFavorites() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('is_favorite', true)
      .order('post_date', { ascending: false });
    
    if (error) throw error;
    
    const container = document.getElementById('favoritesList');
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="padding: 20px; color: #999; text-align: center;">お気に入りはまだありません</p>';
      return;
    }
    
    data.forEach(post => {
      const season = getSeasonColor(post.post_date);
      const item = document.createElement('div');
      item.className = 'favorite-item';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="season-dot" style="background: ${season.color};"></span>
          <span onclick="toggleFavorite('${post.id}', ${post.is_favorite})" style="cursor: pointer; font-size: 20px;">⭐</span>
        </div>
        <div class="favorite-date">${formatDate(post.post_date)}</div>
        <img src="${post.image_url}" alt="${post.comment}" onclick="showPhotoPopup('${post.image_url}')">
        <div class="favorite-comment">${post.comment}</div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading favorites:', err);
  }
}

// Toggle Favorite
async function toggleFavorite(postId, currentState) {
  try {
    const { error } = await supabase
      .from('posts')
      .update({ is_favorite: !currentState })
      .eq('id', postId);
    
    if (error) throw error;
    loadTodayPhoto();
    loadAllPhotos();
    loadFavorites();
  } catch (err) {
    console.error('Error toggling favorite:', err);
  }
}

// Photo Popup
function showPhotoPopup(imageUrl) {
  document.getElementById('popupImage').src = imageUrl;
  document.getElementById('photoPopup').classList.add('active');
}

function closePhotoPopup() {
  document.getElementById('photoPopup').classList.remove('active');
}

// HEIC to JPG Conversion
async function convertHEICtoJPG(file) {
  if (file.type === 'image/heic' || file.name.endsWith('.heic')) {
    try {
      const heic2any = window.heic2any || await import('heic2any');
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg'
      });
      return new File([convertedBlob], file.name.replace('.heic', '.jpg'), { type: 'image/jpeg' });
    } catch (err) {
      console.error('HEIC conversion failed:', err);
      return file;
    }
  }
  return file;
}

// Upload Photo
async function uploadPhoto(file) {
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from('photos')
    .upload(`public/${fileName}`, file);
  
  if (error) throw error;
  
  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(`public/${fileName}`);
  
  return publicUrl;
}

// Post Form Handler
document.addEventListener('DOMContentLoaded', async () => {
  // Load Supabase config
  try {
    const response = await fetch('config.json');
    const config = await response.json();
    await initSupabase(config);
    checkAuth();
  } catch (err) {
    console.error('Error loading config:', err);
    alert('設定ファイルが見つかりません。README を確認してください。');
  }
  
  // Form submission
  document.getElementById('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const photoInput = document.getElementById('photoInput');
      const commentInput = document.getElementById('commentInput');
      let file = photoInput.files[0];
      
      if (!file) {
        document.getElementById('postError').textContent = '写真を選択してください';
        return;
      }
      
      // Convert HEIC to JPG
      file = await convertHEICtoJPG(file);
      
      const comment = commentInput.value.trim();
      if (!comment) {
        document.getElementById('postError').textContent = 'コメントを入力してください';
        return;
      }
      
      const today = getTodayDate();
      
      // Check if today has existing post
      const { data: existingPost } = await supabase
        .from('posts')
        .select('id')
        .eq('post_date', today)
        .single();
      
      if (existingPost) {
        document.getElementById('overwriteWarning').style.display = 'block';
      }
      
      // Upload photo
      const imageUrl = await uploadPhoto(file);
      
      // Upsert post
      const { error } = await supabase
        .from('posts')
        .upsert({
          post_date: today,
          image_url: imageUrl,
          comment: comment,
          is_favorite: false,
          created_at: new Date()
        }, { onConflict: 'post_date' });
      
      if (error) throw error;
      
      document.getElementById('postSuccess').style.display = 'block';
      document.getElementById('postError').textContent = '';
      document.getElementById('overwriteWarning').style.display = 'none';
      
      // Reset form
      document.getElementById('postForm').reset();
      document.getElementById('charCount').textContent = '0';
      
      setTimeout(() => {
        document.getElementById('postSuccess').style.display = 'none';
        loadTodayPhoto();
      }, 2000);
    } catch (err) {
      console.error('Error posting photo:', err);
      document.getElementById('postError').textContent = '投稿に失敗しました: ' + err.message;
    }
  });
  
  // Character counter
  document.getElementById('commentInput').addEventListener('input', (e) => {
    document.getElementById('charCount').textContent = e.target.value.length;
  });
});

// Close popup on outside click
document.addEventListener('click', (e) => {
  const popup = document.getElementById('photoPopup');
  if (e.target === popup) {
    closePhotoPopup();
  }
});
