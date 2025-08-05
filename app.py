from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import json, os, socket

app = Flask(__name__, static_folder='static')
CORS(app)
#socketio = SocketIO(app, cors_allowed_origins="*")
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

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/menu')
def get_menu():
    with open('menu.json') as f:
        return jsonify(json.load(f))
    
@app.route('/api/bridge_consume', methods=['POST'])
def bridge_consume():
    payload = request.json
    uid = payload.get('uid')
    item = payload.get('item')
    cost = payload.get('cost')

    if not uid or not item or not cost:
        return jsonify({"success": False, "error": "Neúplné dáta"}), 400

    data = load_data()
    for user in data['users']:
        if user['uid'] == uid:
            if user['points'] >= cost:
                user['points'] -= cost
                data['log'].append({"uid": uid, "item": item, "cost": cost})
                save_data(data)
                return jsonify({"success": True, "points": user['points']})
            else:
                return jsonify({"success": False, "error": "Nedostatok bodov"}), 400

    return jsonify({"success": False, "error": "Používateľ neexistuje"}), 404

@app.route('/api/users')
def get_users():
    return jsonify(load_data()['users'])

@app.route('/api/log')
def get_log():
    return jsonify(load_data()['log'])

@app.route('/api/consume', methods=['POST'])
@app.route('/api/consume', methods=['POST'])
def consume():
    payload = request.json
    uid = payload['uid']
    items = payload['items']

    data = load_data()

    user = next((u for u in data['users'] if u['uid'] == uid), None)
    if not user:
        return jsonify({"success": False, "error": "Používateľ neexistuje"}), 404

    total_cost = sum(item['count'] * item['cost'] for item in items)

    if user['points'] < total_cost:
        return jsonify({"success": False, "error": "Nedostatok bodov"}), 400

    user['points'] -= total_cost

    data['log'].append({
        "uid": uid,
        "items": items,
        "total_cost": total_cost
    })

    save_data(data)
    return jsonify({"success": True, "points": user['points']})

@app.route('/api/register', methods=['POST'])
def register():
    payload = request.json
    uid = payload['uid']
    name = payload['name']
    points = payload.get('points', 100)

    data = load_data()
    if any(u['uid'] == uid for u in data['users']):
        return jsonify({"success": False, "error": "Používateľ už existuje"}), 400
    
    data['users'].append({
        "uid": uid,
        "name": name,
        "points": points
    })

    save_data(data)
    return jsonify({"success": True})

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


if __name__ == '__main__':
    ip = get_local_ip()
    print(f"\nServer beží na: http://{ip}:5000\n")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)