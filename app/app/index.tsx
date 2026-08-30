import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { listNotes } from '../src/db/notes';
import type { NoteListItem, NoteStatus } from '../src/db/types';
import { formatDuration, formatTimestamp } from '../src/lib/format';
import { colors } from '../src/theme';

function getStatusBadge(status: NoteStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'ready':
      return { label: '✓ Gotowa', bg: '#DCFCE7', text: '#15803D' };
    case 'processing':
      return { label: '⚙ Przetwarzanie…', bg: '#EDE9FE', text: '#6D28D9' };
    case 'uploading':
      return { label: '↑ Wysyłanie…', bg: '#FEF3C7', text: '#B45309' };
    case 'error':
      return { label: '✕ Błąd', bg: '#FEE2E2', text: '#B91C1C' };
    case 'recorded':
    default:
      return { label: '● Nagrana', bg: '#F3F4F6', text: '#4B5563' };
  }
}

export default function IndexScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const allNotes = await listNotes();
      setNotes(allNotes);
    } catch (err) {
      console.error('Błąd ładowania notatek:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onPullRefresh = () => {
    setRefreshing(true);
    void refresh();
  };

  const renderItem = ({ item }: { item: NoteListItem }) => {
    const badge = getStatusBadge(item.status);

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/detail?id=${item.id}`)}
      >
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbIcon}>📝</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {formatTimestamp(item.recordedAt)}
              {item.durationMs ? ` · ${formatDuration(item.durationMs)}` : ''}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          {item.status === 'error' && item.errorMessage && (
            <Text style={styles.errorHint} numberOfLines={1}>
              {item.errorMessage}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.accent} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={notes.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎙️</Text>
              <Text style={styles.emptyTitle}>Brak notatek terenowych</Text>
              <Text style={styles.emptySubtitle}>
                Kliknij przycisk „+” poniżej, aby rozpocząć nagrywanie pierwszej notatki ze zdjęciami.
              </Text>
            </View>
          }
        />
      )}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/record')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loader: { marginTop: 60 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  thumb: { width: 68, height: 68, borderRadius: 10 },
  thumbPlaceholder: {
    backgroundColor: '#EAE6DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: { fontSize: 24 },
  cardBody: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  metaRow: { marginTop: 3 },
  meta: { color: colors.muted, fontSize: 12 },
  bottomRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  errorHint: { color: colors.error, fontSize: 11, marginTop: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabPressed: {
    backgroundColor: '#1E58B8',
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36, fontWeight: '300' },
});
