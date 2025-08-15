import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ImageBackground,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/api";

export default function ProfileScreen({ setIsLoggedIn }) {
  const [user, setUser] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [form, setForm] = useState({});
  const [passwords, setPasswords] = useState({ old_password: "", new_password: "" });

  const getProfile = async () => {
    const token = await AsyncStorage.getItem("token");
    const res = await fetch(`${API_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUser(data);
    setForm(data);
  };

  useEffect(() => {
    getProfile();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    setIsLoggedIn(false);
  };

  const handleUpdate = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "No se encontró el token de autenticación.");
        setIsLoggedIn(false);
        return;
      }

      const res = await fetch(`${API_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.status === 200) {
        Alert.alert("Éxito", data.message);
        setEditMode(false);
        getProfile();
      } else {
        Alert.alert("Error", data.message || "Ocurrió un error desconocido. Intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error al actualizar el perfil:", error);
      Alert.alert("Error de conexión", "No se pudo conectar con el servidor.");
    }
  };

  const handlePasswordChange = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "No se encontró el token de autenticación.");
        setIsLoggedIn(false);
        return;
      }

      const res = await fetch(`${API_URL}/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwords),
      });

      const data = await res.json();

      if (res.status === 200) {
        Alert.alert("Éxito", data.message);
        setPasswordMode(false);
        setPasswords({ old_password: "", new_password: "" });
      } else {
        Alert.alert("Error", data.message || "No se pudo cambiar la contraseña.");
      }
    } catch (error) {
      console.error("Error al cambiar la contraseña:", error);
      Alert.alert("Error de conexión", "No se pudo conectar con el servidor.");
    }
  };

  return (
    <ImageBackground
      source={require("../assets/vacas.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenido, {user.nombre}</Text>
          <Text style={styles.subtitle}>Número de socio: {user.numero_socio}</Text>

          {editMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Editar Perfil</Text>
              <Text style={styles.label}>Nombre:</Text>
              <TextInput
                style={styles.input}
                value={form.nombre}
                onChangeText={(v) => setForm({ ...form, nombre: v })}
              />
              <Text style={styles.label}>Apellido:</Text>
              <TextInput
                style={styles.input}
                value={form.apellido}
                onChangeText={(v) => setForm({ ...form, apellido: v })}
              />
              <Text style={styles.label}>Email:</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
              />
              <Text style={styles.label}>Teléfono:</Text>
              <TextInput
                style={styles.input}
                value={form.telefono}
                onChangeText={(v) => setForm({ ...form, telefono: v })}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.button} onPress={handleUpdate}>
                <Text style={styles.buttonText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditMode(false)}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : passwordMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cambiar Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Contraseña actual"
                secureTextEntry
                value={passwords.old_password}
                onChangeText={(v) => setPasswords({ ...passwords, old_password: v })}
              />
              <TextInput
                style={styles.input}
                placeholder="Nueva contraseña"
                secureTextEntry
                value={passwords.new_password}
                onChangeText={(v) => setPasswords({ ...passwords, new_password: v })}
              />
              <TouchableOpacity style={styles.button} onPress={handlePasswordChange}>
                <Text style={styles.buttonText}>Cambiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPasswordMode(false)}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              <TouchableOpacity style={styles.button} onPress={() => setEditMode(true)}>
                <Text style={styles.buttonText}>Editar perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => setPasswordMode(true)}>
                <Text style={styles.buttonText}>Cambiar contraseña</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.buttonText}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: "#555",
    textAlign: "center",
  },
  section: {
    width: "100%",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  label: {
    fontSize: 16,
    color: "#333",
    alignSelf: "flex-start",
    marginBottom: 5,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
    width: "100%",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#009b94",
    padding: 12,
    borderRadius: 5,
    marginBottom: 10,
    width: "100%",
  },
  logoutButton: {
    backgroundColor: "red",
    padding: 12,
    borderRadius: 5,
    marginTop: 10,
    width: "100%",
  },
  cancelButton: {
    backgroundColor: "gray",
    padding: 12,
    borderRadius: 5,
    marginBottom: 10,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  buttonsContainer: {
    width: "100%",
  },
});
