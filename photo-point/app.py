import os
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, render_template

from config import Config
from photo_booth.camera import capture
from photo_booth.frame import list_frames, apply_frame
from photo_booth.printer import is_available as printer_available, list_printers, print_photo
from photo_booth.emailer import is_available as email_available, send_photo

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = Config.SECRET_KEY

Path(Config.CAPTURES_DIR).mkdir(parents=True, exist_ok=True)
Path(Config.FRAMES_DIR).mkdir(parents=True, exist_ok=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/gallery')
def gallery():
    return render_template('gallery.html')


@app.route('/api/photos')
def list_photos():
    photos_dir = Path(Config.CAPTURES_DIR)
    photos = []
    for f in sorted(photos_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.suffix.lower() in ('.jpg', '.jpeg', '.png'):
            photos.append({
                'filename': f.name,
                'url': f'/api/photo/{f.name}',
                'taken_at': f.stat().st_mtime,
            })
    return jsonify(photos)


@app.route('/api/status')
def status():
    frames_list = list_frames()
    printers_list = list_printers() if printer_available() else []
    return jsonify({
        'camera': True,
        'frames': len(frames_list),
        'frames_list': [{'id': f['id'], 'filename': f['filename']} for f in frames_list],
        'printer': printer_available(),
        'printers': printers_list,
        'email': email_available(),
    })


@app.route('/api/frames')
def frames():
    return jsonify([{'id': f['id'], 'filename': f['filename']} for f in list_frames()])


@app.route('/api/frames/<frame_id>')
def frame_preview(frame_id: str):
    frames_list = list_frames()
    for f in frames_list:
        if f['id'] == frame_id:
            return send_from_directory(Config.FRAMES_DIR, f['filename'])
    return jsonify({'error': 'Frame not found'}), 404


@app.route('/api/capture', methods=['POST'])
def do_capture():
    frame_id = request.json.get('frame_id') if request.is_json else None

    raw_path = os.path.join(Config.CAPTURES_DIR, f'raw_{uuid.uuid4().hex}.jpg')
    result = capture(raw_path)
    if result is None:
        return jsonify({'error': 'Camera capture failed'}), 500

    output_path = os.path.join(Config.CAPTURES_DIR, f'photo_{uuid.uuid4().hex}.jpg')

    if frame_id:
        frames_list = list_frames()
        frame_path = None
        for f in frames_list:
            if f['id'] == frame_id:
                frame_path = f['path']
                break
        if frame_path:
            result = apply_frame(raw_path, frame_path, output_path)
            if result is None:
                output_path = raw_path
        else:
            output_path = raw_path
    else:
        output_path = raw_path

    return jsonify({
        'photo_id': Path(output_path).stem,
        'filename': Path(output_path).name,
        'url': f'/api/photo/{Path(output_path).name}',
    })


@app.route('/api/photo/<filename>')
def get_photo(filename: str):
    return send_from_directory(Config.CAPTURES_DIR, filename)


@app.route('/api/photo/<filename>', methods=['DELETE'])
def delete_photo(filename: str):
    filepath = os.path.join(Config.CAPTURES_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Photo not found'}), 404
    os.remove(filepath)
    return jsonify({'success': True})


@app.route('/api/print', methods=['POST'])
def do_print():
    if not printer_available():
        return jsonify({'error': 'Printer not available'}), 503

    data = request.get_json(silent=True) or {}
    filename = data.get('filename', '')
    printer_name = data.get('printer', '')

    if not filename:
        return jsonify({'error': 'Missing filename'}), 400

    filepath = os.path.join(Config.CAPTURES_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Photo not found'}), 404

    success = print_photo(filepath, printer_name or None)
    if not success:
        return jsonify({'error': 'Print failed'}), 500

    return jsonify({'success': True})


@app.route('/api/email', methods=['POST'])
def do_email():
    if not email_available():
        return jsonify({'error': 'Email not configured'}), 503

    data = request.get_json(silent=True) or {}
    recipient = data.get('recipient', '')
    filename = data.get('filename', '')
    message = data.get('message', '')

    if not recipient or not filename:
        return jsonify({'error': 'Missing recipient or filename'}), 400

    filepath = os.path.join(Config.CAPTURES_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Photo not found'}), 404

    success = send_photo(recipient, filepath, message)
    if not success:
        return jsonify({'error': 'Email send failed'}), 500

    return jsonify({'success': True})


@app.route('/api/frames/upload', methods=['POST'])
def upload_frame():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.png', '.jpg', '.jpeg'):
        return jsonify({'error': 'Only PNG/JPG allowed'}), 400

    filename = f'{uuid.uuid4().hex}{ext}'
    file.save(os.path.join(Config.FRAMES_DIR, filename))

    return jsonify({'success': True, 'id': Path(filename).stem, 'filename': filename})


@app.route('/api/frames/<frame_id>', methods=['DELETE'])
def delete_frame(frame_id: str):
    frames_list = list_frames()
    for f in frames_list:
        if f['id'] == frame_id:
            os.remove(f['path'])
            return jsonify({'success': True})
    return jsonify({'error': 'Frame not found'}), 404


if __name__ == '__main__':
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
