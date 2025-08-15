import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import ProfileScreen from "../screens/ProfileScreen";
import OfertasScreen from "../screens/OfertasScreen";
import PagosScreen from "../screens/PagosScreen";

const Tab = createBottomTabNavigator();

export default function MainTabs({ setIsLoggedIn }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Perfil") iconName = "person-circle";
          else if (route.name === "Ofertas") iconName = "pricetags";
          else if (route.name === "Pagos") iconName = "card";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#009b94",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen name="Perfil">
        {(props) => <ProfileScreen {...props} setIsLoggedIn={setIsLoggedIn} />}
      </Tab.Screen>
      <Tab.Screen name="Ofertas" component={OfertasScreen} />
      <Tab.Screen name="Pagos" component={PagosScreen} />
    </Tab.Navigator>
  );
}