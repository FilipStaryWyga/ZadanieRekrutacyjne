import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getNote } from '../src/db/notes';
import type { Note } from '../src/db/types';
import { formatDuration, formatOffset, formatTimestamp } from '../src/lib/format';
import { colors } from '../src/theme';

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    void (async () => {
      const noteId = Array.isArray(id) ? id[0] : id;
      if (!noteId) return;
      setNote(await getNote(noteId));
    })();
  }, [id]);

  if (!note) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Ładowanie…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{note.title}</Text>
      <Text style={styles.meta}>
        {formatTimestamp(note.recordedAt)} · {note.status} · audio{' '}
        {formatDuration(note.durationMs)}
      </Text>

      {note.summary ? <Text style={styles.summary}>{note.summary}</Text> : null}
      {!note.summary ? (
        <Text style={styles.hint}>Brak podsumowania (oczekuje na przetworzenie)</Text>
      ) : null}

      <Text style={styles.section}>Zdjęcia</Text>
      {note.photos.length === 0 ? (
        <Text style={styles.hint}>Brak zdjęć</Text>
      ) : (
        <FlatList
          data={note.photos}
          keyExtractor={(item) => item.id}
          horizontal
          renderItem={({ item }) => (
            <View>
              <Image source={{ uri: item.uri }} style={styles.photo} />
              <Text style={styles.offset}>{formatOffset(item.offsetMs)}</Text>
            </View>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, marginTop: 6, fontSize: 14 },
  summary: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    color: colors.text,
  },
  hint: { color: colors.muted, marginTop: 8 },
  section: { marginTop: 24, fontSize: 18, fontWeight: '600', color: colors.text },
  photo: { width: 160, height: 160, borderRadius: 10, marginRight: 10 },
  offset: { marginTop: 4, color: colors.muted, fontVariant: ['tabular-nums'] },
});
