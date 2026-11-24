import { state, notify, persistState, esc } from './store.js';

const audio = new Audio();
audio.preload = 'none';

let playlist = []; // combined radio + local files
let currentIdx = 0;
let playing = false;
let loading = false;
let errorMsg = '';

function rebuildPlaylist(localItems = []) {
  const radios = state.radios.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist || 'วิทยุออนไลน์',
    url: r.url,
    isLive: true
  }));
  const existingLocals = localItems.length
    ? localItems
    : playlist.filter((t) => !t.isLive);
  playlist = [...existingLocals, ...radios];
  if (currentIdx >= playlist.length) currentIdx = 0;
}

export function getMediaState() {
  const track = playlist[currentIdx] || {
    title: 'ยังไม่มีเพลง',
    artist: 'เลือกสถานีวิทยุ หรือไฟล์เพลงจากเครื่อง',
    isLive: true
  };
  const pct = (!track.isLive && audio.duration && Number.isFinite(audio.duration))
    ? (audio.currentTime / audio.duration) * 100
    : (playing ? 100 : 0);

  return {
    track,
    playlist,
    currentIdx,
    playing,
    loading,
    errorMsg,
    progressPct: Math.min(100, Math.max(0, pct))
  };
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const { track } = getMediaState();
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'RideDash Audio'
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  } catch (e) {}
}

export function selectTrack(idx, autoPlay = true) {
  if (!playlist.length) return;
  currentIdx = ((idx % playlist.length) + playlist.length) % playlist.length;
  const track = playlist[currentIdx];
  errorMsg = '';
  audio.src = track.url;
  if (autoPlay) {
    playMedia();
  } else {
    notify('media');
  }
}

export function playMedia() {
  if (!playlist.length) return;
  const track = playlist[currentIdx];
  if (!audio.src || audio.src !== track.url) {
    audio.src = track.url;
  }
  loading = true;
  errorMsg = '';
  notify('media');

  audio.play()
    .then(() => {
      playing = true;
      loading = false;
      updateMediaSession();
      notify('media');
    })
    .catch(() => {
      playing = false;
      loading = false;
      errorMsg = 'เล่นเสียงไม่สำเร็จ (ลองสถานีอื่น หรือเลือกไฟล์ในเครื่อง)';
      notify('media');
    });
}

export function pauseMedia() {
  audio.pause();
  playing = false;
  loading = false;
  updateMediaSession();
  notify('media');
}

export function togglePlay() {
  if (playing) pauseMedia();
  else playMedia();
}

export function nextTrack() {
  if (!playlist.length) return;
  selectTrack(currentIdx + 1, true);
}

export function prevTrack() {
  if (!playlist.length) return;
  selectTrack(currentIdx - 1, true);
}

export function seekPercent(pct) {
  const { track } = getMediaState();
  if (track.isLive || !audio.duration || !Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.duration * pct));
  notify('media');
}

export function loadLocalFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const localTracks = files.map((file, i) => ({
    id: 'local-' + Date.now() + '-' + i,
    title: file.name.replace(/\.[^.]+$/, ''),
    artist: 'ไฟล์เพลงในเครื่อง',
    url: URL.createObjectURL(file),
    isLive: false
  }));
  rebuildPlaylist(localTracks);
  selectTrack(0, true);
}

export function addRadioStation(title, url) {
  if (!title || !url) return;
  state.radios.unshift({
    id: 'r-' + Date.now(),
    title: title.slice(0, 40),
    artist: 'สถานีที่เพิ่มเอง',
    url: url.trim()
  });
  state.radios = state.radios.slice(0, 12);
  persistState();
  rebuildPlaylist();
  notify('media');
}

export function initMedia() {
  rebuildPlaylist();

  audio.addEventListener('timeupdate', () => {
    if (playing) notify('media-progress');
  });
  audio.addEventListener('ended', () => {
    const { track } = getMediaState();
    if (!track.isLive) nextTrack();
  });
  audio.addEventListener('error', () => {
    playing = false;
    loading = false;
    errorMsg = 'ไม่สามารถเชื่อมต่อสตรีมเสียงนี้ได้';
    notify('media');
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', playMedia);
      navigator.mediaSession.setActionHandler('pause', pauseMedia);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    } catch (e) {}
  }

  const fileInput = document.getElementById('localAudioInput');
  if (fileInput) {
    fileInput.onchange = (e) => loadLocalFiles(e.target.files);
  }
}

export function renderRadioButtons(container) {
  if (!container) return;
  const { playlist: list, currentIdx: cur } = getMediaState();
  container.innerHTML = list.map((t, idx) =>
    `<button class="dash-pill-btn${idx === cur ? ' active' : ''}" data-track="${idx}">${t.isLive ? '📻 ' : '🎵 '}${esc(t.title)}</button>`
  ).join('');
  container.querySelectorAll('[data-track]').forEach((btn) => {
    btn.onclick = () => selectTrack(Number(btn.dataset.track), true);
  });
}
