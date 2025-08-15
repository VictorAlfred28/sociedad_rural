import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";

export default function PagosScreen() {
  const handlePago = () => {
    Alert.alert("Pago", "Aquí iría la integración con el sistema de pago");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagos de cuota mensual</Text>
      <Text style={styles.subtitle}>
        Desde aquí podrás abonar tu cuota mensual de socio.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handlePago}>
        <Text style={styles.buttonText}>Pagar cuota mensual</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  subtitle: { fontSize: 16, marginBottom: 20, textAlign: "center" },
  button: { backgroundColor: "#009b94", padding: 15, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
