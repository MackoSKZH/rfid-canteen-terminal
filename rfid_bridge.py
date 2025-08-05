import socketio

sio = socketio.Client()
sio.connect('http://192.168.88.232:5000')

print("Bridge pripojený k serveru.")
print("Zadaj testovacie UID (alebo pripoj čítačku):")

while True:
    uid = input("UID: ").strip()
    if uid:
        print(f"Posielam UID: {uid}")
        sio.emit('card_uid', uid)
