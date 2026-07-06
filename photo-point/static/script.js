let currentPhotoId = null;
let currentFilename = null;
let selectedFrameId = 'oldstylediapo';

document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  const upload = document.getElementById('frame-upload');
  if (upload) {
    upload.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') uploadFrame();
    });
  }
});

async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    document.getElementById('status-camera').textContent = 'Camera: OK';
    document.getElementById('status-camera').className = 'badge ok';

    if (data.printer) {
      document.getElementById('status-printer').textContent = `Stampante: ${data.printers.length} disponibile`;
      document.getElementById('status-printer').className = 'badge ok';
    } else {
      document.getElementById('status-printer').textContent = 'Stampante: N/A';
      document.getElementById('status-printer').className = 'badge na';
    }

    if (data.email) {
      document.getElementById('status-email').textContent = 'Email: configurata';
      document.getElementById('status-email').className = 'badge ok';
    } else {
      document.getElementById('status-email').textContent = 'Email: N/A';
      document.getElementById('status-email').className = 'badge na';
    }

    loadFrames(data.frames_list);
  } catch (err) {
    document.getElementById('status-camera').textContent = 'Camera: ERR';
    document.getElementById('status-camera').className = 'badge err';
  }
}

async function loadFrames(framesList) {
  const container = document.getElementById('frame-selector');
  container.innerHTML = '';

  const noneOpt = document.createElement('div');
  noneOpt.className = 'frame-option selected';
  noneOpt.dataset.frameId = '';
  noneOpt.innerHTML = '<div class="frame-thumb">Nessuna</div>';
  noneOpt.onclick = () => selectFrame(noneOpt, '');
  container.appendChild(noneOpt);

  for (const f of framesList) {
    const opt = document.createElement('div');
    opt.className = 'frame-option';
    opt.dataset.frameId = f.id;

    const img = document.createElement('img');
    img.src = `/api/frames/${f.id}`;
    img.alt = f.filename;

    const del = document.createElement('button');
    del.className = 'delete-frame';
    del.textContent = '×';
    del.onclick = (e) => { e.stopPropagation(); deleteFrame(f.id); };

    opt.appendChild(img);
    opt.appendChild(del);
    opt.onclick = () => selectFrame(opt, f.id);
    container.appendChild(opt);
  }
}

function selectFrame(el, frameId) {
  document.querySelectorAll('.frame-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedFrameId = frameId;
}

async function capture() {
  const btn = document.getElementById('btn-capture');
  const msg = document.getElementById('capture-message');
  const img = document.getElementById('preview-img');
  const placeholder = document.getElementById('placeholder');

  btn.disabled = true;
  msg.textContent = 'Scatto in corso...';
  msg.className = 'message';

  try {
    const res = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame_id: selectedFrameId || undefined }),
    });

    if (!res.ok) {
      const err = await res.json();
      msg.textContent = err.error || 'Errore durante lo scatto';
      msg.className = 'message error';
      return;
    }

    const data = await res.json();
    currentPhotoId = data.photo_id;
    currentFilename = data.filename;

    img.src = data.url + '?t=' + Date.now();
    img.style.display = 'block';
    placeholder.style.display = 'none';

    document.getElementById('btn-print').disabled = false;
    document.getElementById('btn-email').disabled = false;

    msg.textContent = 'Foto scattata!';
    msg.className = 'message success';
  } catch (err) {
    msg.textContent = 'Errore di connessione';
    msg.className = 'message error';
  } finally {
    btn.disabled = false;
  }
}

async function printPhoto() {
  if (!currentFilename) return;

  const msg = document.getElementById('capture-message');
  msg.textContent = 'Invio in stampa...';
  msg.className = 'message';

  try {
    const res = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: currentFilename }),
    });

    if (!res.ok) {
      const err = await res.json();
      msg.textContent = err.error || 'Errore di stampa';
      msg.className = 'message error';
      return;
    }

    msg.textContent = 'Foto stampata!';
    msg.className = 'message success';
  } catch (err) {
    msg.textContent = 'Errore di connessione';
    msg.className = 'message error';
  }
}

function showEmailDialog() {
  document.getElementById('email-dialog').style.display = 'block';
}

function hideEmailDialog() {
  document.getElementById('email-dialog').style.display = 'none';
  document.getElementById('email-input').value = '';
}

async function sendEmail() {
  const recipient = document.getElementById('email-input').value.trim();
  if (!recipient || !currentFilename) return;

  const msg = document.getElementById('capture-message');
  msg.textContent = 'Invio email...';
  msg.className = 'message';

  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, filename: currentFilename }),
    });

    if (!res.ok) {
      const err = await res.json();
      msg.textContent = err.error || 'Errore invio email';
      msg.className = 'message error';
      return;
    }

    msg.textContent = 'Email inviata!';
    msg.className = 'message success';
    hideEmailDialog();
  } catch (err) {
    msg.textContent = 'Errore di connessione';
    msg.className = 'message error';
  }
}

async function uploadFrame() {
  const input = document.getElementById('frame-upload');
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/frames/upload', { method: 'POST', body: formData });
    if (!res.ok) return;
    input.value = '';
    checkStatus();
  } catch (err) {}
}

async function deleteFrame(frameId) {
  if (!confirm('Eliminare questa cornice?')) return;

  try {
    const res = await fetch(`/api/frames/${frameId}`, { method: 'DELETE' });
    if (!res.ok) return;
    checkStatus();
  } catch (err) {}
}
