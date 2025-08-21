from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import json, os, socket

app = Flask(__name__, static_folder='static')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

DATA_FILE = 'data.json'

if not os.path.exists(DATA_FILE) or os.path.getsize(DATA_FILE) == 0:
    with open(DATA_FILE, 'w') as f:
        json.dump({"users": [], "log": []}, f)

def load_data():
    with open(DATA_FILE) as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def find_user(data, uid):
    return next((u for u in data['users'] if u['uid'] == uid), None)

def generate_animator_name(data):
    existing = {u['name'] for u in data['users']}
    n = 1
    while True:
        candidate = f"Animátor {n}"
        if candidate not in existing:
            return candidate
        n += 1

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/menu')
def get_menu():
    path = os.path.join(app.root_path, 'menu.json')
    try:
        with open(path) as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({"error": "menu.json not found", "looked_in": path}), 404

@app.route('/api/points_menu')
def get_points_menu():
    path = 'points_menu.json'
    try:
        with open(path) as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({"error": "points_menu.json not found", "looked_in": path}), 404
    except Exception as e:
        return jsonify({"error": "Failed to read points_menu.json", "detail": str(e)}), 500

@app.route('/api/users')
def get_users():
    return jsonify(load_data()['users'])

@app.route('/api/log')
def get_log():
    return jsonify(load_data()['log'])

@app.route('/api/consume', methods=['POST'])
def consume():
    payload = request.json or {}
    uid = payload.get('uid')
    items = payload.get('items', [])

    if not uid:
        return jsonify({"success": False, "error": "Chýba UID"}), 400
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"success": False, "error": "Objednávka je prázdna"}), 400

    data = load_data()
    user = find_user(data, uid)
    if not user:
        return jsonify({"success": False, "error": "Karta nie je registrovaná"}), 404

    total_cost = 0
    try:
        for item in items:
            count = int(item.get('count', 0))
            cost = int(item.get('cost', 0))
            if count < 0 or cost < 0:
                return jsonify({"success": False, "error": "Neplatná položka"}), 400
            total_cost += count * cost
    except Exception:
        return jsonify({"success": False, "error": "Neplatný formát položiek"}), 400

    if total_cost == 0:
        return jsonify({"success": False, "error": "Objednávka je prázdna"}), 400

    if user['points'] < total_cost:
        return jsonify({"success": False, "error": "Nedostatok bodov"}), 400

    user['points'] -= total_cost

    data['log'].append({
        "action": "consume",
        "uid": uid,
        "items": items,
        "total_cost": total_cost,
        "total_after": user['points']
    })

    save_data(data)
    return jsonify({"success": True, "points": user['points']})

@app.route('/api/topup', methods=['POST'])
def topup():
    payload = request.json or {}
    uid = payload.get('uid')
    points = payload.get('points')

    if not uid:
        return jsonify({"success": False, "error": "Chýba UID"}), 400
    try:
        points = int(points)
    except Exception:
        return jsonify({"success": False, "error": "Neplatná hodnota dobíjania"}), 400
    if points <= 0:
        return jsonify({"success": False, "error": "Neplatná hodnota dobíjania"}), 400

    data = load_data()
    user = find_user(data, uid)

    if not user:
        auto_name = generate_animator_name(data)
        user = {"uid": uid, "name": auto_name, "points": 0}
        data['users'].append(user)
        data['log'].append({
            "action": "register",
            "uid": uid,
            "name": auto_name,
            "initial_points": 0
        })

    user['points'] += points

    data['log'].append({
        "action": "topup",
        "uid": uid,
        "points_added": points,
        "total_after": user['points']
    })

    save_data(data)
    return jsonify({"success": True, "points": user['points'], "name": user['name']})

@app.route('/api/register', methods=['POST'])
def register():
    payload = request.json or {}
    uid = payload.get('uid')
    name = (payload.get('name') or '').strip()
    points = payload.get('points', 0)

    if not uid:
        return jsonify({"success": False, "error": "Chýba UID"}), 400

    data = load_data()
    if find_user(data, uid):
        return jsonify({"success": False, "error": "Používateľ už existuje"}), 400

    if not name:
        name = generate_animator_name(data)

    try:
        points = int(points)
    except Exception:
        points = 0
    if points < 0:
        points = 0

    new_user = {
        "uid": uid,
        "name": name,
        "points": points
    }
    data['users'].append(new_user)
    data['log'].append({
        "action": "register",
        "uid": uid,
        "name": name,
        "initial_points": points
    })

    save_data(data)
    return jsonify({"success": True, "name": name, "points": points})

@socketio.on('connect')
def on_connect():
    print('WebSocket klient pripojený')

@socketio.on('card_uid')
def handle_card_uid(uid):
    print(f"Prijaté UID od bridge: {uid}")
    emit('card-uid', uid, broadcast=True)

@app.route('/ping')
def ping():
    return "OK"

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

@app.route('/__routes')
def __routes():
    return '<br>'.join(sorted(str(r) for r in app.url_map.iter_rules()))

if __name__ == '__main__':
    ip = get_local_ip()
    print(f"\nServer beží na: http://{ip}:5000\n")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)