import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Notatki terenowe' }} />
      <Stack.Screen name="record" options={{ title: 'Nowa notatka' }} />
      <Stack.Screen name="detail" options={{ title: 'Szczegóły' }} />
    </Stack>
  );
}
