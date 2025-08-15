import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/api";

export default function OfertasScreen() {
  const [ofertas, setOfertas] = useState([]);

  const getOfertas = async () => {
    const token = await AsyncStorage.getItem("token");
    const res = await fetch(`${API_URL}/ofertas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setOfertas(data);
  };

  useEffect(() => {
    getOfertas();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ofertas y Descuentos</Text>
      {ofertas.length === 0 ? (
        <Text>No hay ofertas disponibles</Text>
      ) : (
        ofertas.map((oferta) => (
          <View key={oferta.id} style={styles.ofertaContainer}>
            <Text style={styles.ofertaTitulo}>{oferta.titulo}</Text>
            <Text>{oferta.descripcion}</Text>
            <Text style={styles.ofertaFecha}>
              {oferta.fecha_inicio} - {oferta.fecha_fin}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },
  ofertaContainer: { padding: 10, borderWidth: 1, borderColor: "#ccc", borderRadius: 5, marginBottom: 10 },
  ofertaTitulo: { fontWeight: "bold", fontSize: 16 },
  ofertaFecha: { fontSize: 12, color: "#555" },
});
