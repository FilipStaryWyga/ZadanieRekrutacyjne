import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { NoteRepository } from '../src/db/repository';
import type { DBNote } from '../src/db/types';
import { formatTimestamp } from '../src/lib/format';

export default function IndexScreen() {
  const router = useRouter();
  const repository = new NoteRepository();
  const [notes, setNotes] = useState<DBNote[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const allNotes = await repository.getAllNotes();
    setNotes(allNotes);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const renderItem = ({ item }: { item: DBNote }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/detail?id=${item.id}`)}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{formatTimestamp(item.recordedAt)}</Text>
      {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={styles.loader} />
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
  container: { flex: 1, padding: 16 },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '600' },
  meta: { color: '#666', marginTop: 4, fontSize: 13 },
  summary: { marginTop: 8, color: '#333' },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2f6fdb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
