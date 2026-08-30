import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { listNotes } from '../src/db/notes';
import type { NoteListItem } from '../src/db/types';
import { formatTimestamp } from '../src/lib/format';
import { colors } from '../src/theme';

export default function IndexScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const allNotes = await listNotes();
    setNotes(allNotes);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const renderItem = ({ item }: { item: NoteListItem }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/detail?id=${item.id}`)}
    >
      {item.thumbnailUri ? (
        <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {formatTimestamp(item.recordedAt)} · {item.status}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accent} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>Brak notatek</Text>}
        />
      )}
      <Pressable style={styles.fab} onPress={() => router.push('/record')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: colors.border },
  cardBody: { flex: 1 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.muted },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
