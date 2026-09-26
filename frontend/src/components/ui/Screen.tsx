import React, { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

interface Props {
  children: ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  bare?: boolean;
}

/** Dark-themed screen wrapper with safe-area handling and the light status bar the mockup uses. */
export default function Screen({ children, edges = ['top', 'bottom'], style, bare }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {bare ? (
        <View style={[styles.root, style]}>{children}</View>
      ) : (
        <SafeAreaView style={[styles.root, style]} edges={edges}>
          {children}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
