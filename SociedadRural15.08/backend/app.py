from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import mysql.connector
from mysql.connector import IntegrityError
from datetime import timedelta
import re
import bcrypt

app = Flask(__name__)
CORS(app)

# Configuración del JWT
app.config["JWT_SECRET_KEY"] = "clave-super-secreta"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1)
jwt = JWTManager(app)

# Conexión a la base de datos
try:
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="1234",
        database="socios"
    )
    cursor = db.cursor(dictionary=True)
except mysql.connector.Error as e:
    print(f"Error al conectar a la base de datos: {e}")

# ======================
#  FUNCIONES GLOBALES
# ======================

def generar_numero_socio():
    try:
        cursor.execute("SELECT MAX(numero_socio) as max_num FROM usuarios")
        result = cursor.fetchone()
        if result and result["max_num"]:
            return result["max_num"] + 1
        return 1000
    except Exception as e:
        print(f"Error al generar número de socio: {e}")
        return None

# ======================
#  RUTAS DEL BACKEND
# ======================

# Registro de usuarios
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    nombre = data.get("nombre")
    apellido = data.get("apellido")
    dni = data.get("dni")
    telefono = data.get("telefono")
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")

    if not all([nombre, apellido, dni, telefono, email, username, password]):
        return jsonify({"message": "Todos los campos son requeridos"}), 400

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"message": "Email inválido"}), 400

    if not dni.isdigit():
        return jsonify({"message": "DNI debe ser numérico"}), 400
    if not telefono.isdigit():
        return jsonify({"message": "Teléfono debe ser numérico"}), 400

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    numero_socio = generar_numero_socio()
    if numero_socio is None:
        return jsonify({"message": "Error al generar número de socio"}), 500

    try:
        cursor.execute("""
            INSERT INTO usuarios (nombre, apellido, dni, telefono, email, username, password, numero_socio)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            nombre, apellido, dni, telefono, email, username, hashed_pw, numero_socio
        ))
        db.commit()
        return jsonify({"message": "Registrado correctamente"}), 201
    except IntegrityError:
        db.rollback()
        return jsonify({"message": "Usuario o email ya existe"}), 409
    except Exception as e:
        db.rollback()
        return jsonify({"message": "Error en el registro", "error": str(e)}), 500

# Login
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    cursor.execute("SELECT * FROM usuarios WHERE username = %s", (username,))
    user = cursor.fetchone()

    if user and bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
        access_token = create_access_token(identity=user["id"])
        return jsonify({"message": "Acceso concedido", "token": access_token}), 200
    return jsonify({"message": "Credenciales inválidas"}), 401

# Ver perfil
@app.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    user_id = get_jwt_identity()
    cursor.execute("SELECT nombre, apellido, email, telefono, numero_socio FROM usuarios WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    if user:
        return jsonify(user), 200
    return jsonify({"message": "Usuario no encontrado"}), 404

# Editar perfil (¡VERSIÓN MEJORADA!)
@app.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json()

    # Construye la consulta SQL de forma dinámica
    updates = []
    params = []
    
    if "nombre" in data and data["nombre"] is not None:
        updates.append("nombre = %s")
        params.append(data["nombre"])
    if "apellido" in data and data["apellido"] is not None:
        updates.append("apellido = %s")
        params.append(data["apellido"])
    if "email" in data and data["email"] is not None:
        updates.append("email = %s")
        params.append(data["email"])
    if "telefono" in data and data["telefono"] is not None:
        updates.append("telefono = %s")
        params.append(data["telefono"])
    
    # Si no hay nada que actualizar, devuelve un mensaje
    if not updates:
        return jsonify({"message": "No hay campos para actualizar"}), 400

    # Añade el ID de usuario a los parámetros
    params.append(user_id)
    
    query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id=%s"
    
    try:
        cursor.execute(query, tuple(params))
        db.commit()
        return jsonify({"message": "Perfil actualizado correctamente"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"message": "Error al actualizar el perfil", "error": str(e)}), 500

# Cambiar contraseña
@app.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.get_json()
    old_pw = data.get("old_password")
    new_pw = data.get("new_password")

    cursor.execute("SELECT password FROM usuarios WHERE id=%s", (user_id,))
    user = cursor.fetchone()

    if not user or not bcrypt.checkpw(old_pw.encode("utf-8"), user["password"].encode("utf-8")):
        return jsonify({"message": "Contraseña actual incorrecta"}), 400

    hashed_pw = bcrypt.hashpw(new_pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    cursor.execute("UPDATE usuarios SET password=%s WHERE id=%s", (hashed_pw, user_id))
    db.commit()
    return jsonify({"message": "Contraseña cambiada correctamente"}), 200

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")