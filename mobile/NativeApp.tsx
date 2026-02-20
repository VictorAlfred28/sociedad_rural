import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
// Nota: En un proyecto Expo real, instalar: expo-status-bar, expo-secure-store, lucide-react-native
// import { StatusBar } from 'expo-status-bar';
// import * as SecureStore from 'expo-secure-store';
// import { QrCode, CreditCard, User, LogOut } from 'lucide-react-native';

/**
 * MOCK SERVICES for React Native Environment
 * En producción, esto se extrae a un archivo 'api_adapter.ts' que usa fetch nativo
 */
const API_URL = "http://10.0.2.2:8000/api/v1"; // 10.0.2.2 para Android Emulator, localhost para iOS

const NativeAuth = {
  login: async (dni, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${dni}&password=${password}`
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      return data;
    } catch (e) {
      throw e;
    }
  }
};

/**
 * COMPONENTE PRINCIPAL DE LA APP NATIVA
 * Copiar este código en App.js de un proyecto Expo nuevo.
 */
export default function NativeApp() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Estados Form Login
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await NativeAuth.login(dni, password);
      setToken(data.access_token);
      setProfile(data.profile);
      // await SecureStore.setItemAsync('token', data.access_token);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo conectar");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setProfile(null);
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <View style={styles.loginCard}>
          <View style={styles.logoContainer}>
             <Text style={styles.logoText}>SR</Text>
          </View>
          <Text style={styles.title}>Sociedad Rural</Text>
          <Text style={styles.subtitle}>App Oficial de Socios</Text>

          <View style={styles.inputContainer}>
            {/* Inputs simulados con View para este ejemplo de texto */}
            <Text style={styles.label}>DNI / Usuario</Text>
            <View style={styles.inputPlaceholder}><Text>{dni || 'Ingrese DNI'}</Text></View>
            
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputPlaceholder}><Text>••••••</Text></View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>INGRESAR</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hola, {profile?.nombre}</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={{color: 'white', fontSize: 12}}>SALIR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* CARNET DIGITAL */}
        <View style={styles.card}>
          <View style={[styles.cardHeader, {backgroundColor: '#1B4332'}]}>
            <Text style={styles.cardTitleWhite}>Carnet Digital</Text>
          </View>
          <View style={styles.qrContainer}>
             <Image 
                style={{width: 150, height: 150}} 
                source={{uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${profile?.id}`}} 
             />
             <Text style={styles.socioId}>{profile?.id?.substring(0,8).toUpperCase()}</Text>
          </View>
        </View>

        {/* ESTADO CUENTA */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <Text style={styles.cardTitle}>Estado de Cuenta</Text>
          </View>
          <View style={styles.cardBody}>
             <Text style={styles.monto}>$5.000</Text>
             <Text style={styles.status}>Pendiente de Pago</Text>
             <TouchableOpacity style={styles.payButton}>
                <Text style={styles.payButtonText}>PAGAR CON MERCADO PAGO</Text>
             </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
      
      {/* BOTTOM NAV SIMULADO */}
      <View style={styles.bottomNav}>
         <View style={styles.navItem}><Text style={styles.navText}>INICIO</Text></View>
         <View style={styles.navItem}><Text style={styles.navText}>CARNET</Text></View>
         <View style={styles.navItem}><Text style={styles.navText}>PAGOS</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loginCard: {
    margin: 20,
    marginTop: 100,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  logoContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#1B4332',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoText: { color: '#D4AF37', fontWeight: 'bold', fontSize: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 30 },
  inputContainer: { width: '100%', marginBottom: 20 },
  label: { fontSize: 12, color: '#666', marginBottom: 5 },
  inputPlaceholder: {
    width: '100%', height: 45, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15, justifyContent: 'center', paddingHorizontal: 15
  },
  button: {
    width: '100%', height: 50, backgroundColor: '#1B4332', borderRadius: 10, justifyContent: 'center', alignItems: 'center'
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  header: {
    backgroundColor: '#1B4332',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20 },
  card: {
    backgroundColor: 'white', borderRadius: 15, marginBottom: 20, overflow: 'hidden', elevation: 3
  },
  cardHeader: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cardTitle: { fontWeight: 'bold', color: '#333' },
  cardTitleWhite: { fontWeight: 'bold', color: 'white' },
  qrContainer: { padding: 30, alignItems: 'center' },
  socioId: { marginTop: 15, fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', color: '#555' },
  cardBody: { padding: 20, alignItems: 'center' },
  monto: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  status: { color: '#D32F2F', backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 5, marginVertical: 5, fontSize: 12 },
  payButton: { marginTop: 15, backgroundColor: '#009EE3', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, width: '100%', alignItems: 'center' },
  payButtonText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  bottomNav: {
    flexDirection: 'row', height: 60, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#eee', justifyContent: 'space-around', alignItems: 'center'
  },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 10, fontWeight: 'bold', color: '#888', marginTop: 4 }
});
