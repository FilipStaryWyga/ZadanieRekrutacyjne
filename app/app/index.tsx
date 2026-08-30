import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  StatusBar,
  LayoutAnimation,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { listNotes } from '../src/db/notes';
import type { NoteListItem, NoteStatus } from '../src/db/types';
import { formatDuration, formatTimestamp } from '../src/lib/format';
import { colors } from '../src/theme';

/* ─── helpers ─── */
function getStatusMeta(status: NoteStatus) {
  switch (status) {
    case 'ready':
      return { label: 'Gotowa', bg: '#ECFDF5', text: '#047857', bar: '#10B981' };
    case 'processing':
      return { label: 'Przetwarzanie…', bg: '#F5F3FF', text: '#6D28D9', bar: '#8B5CF6' };
    case 'uploading':
      return { label: 'Wysyłanie…', bg: '#FFFBEB', text: '#B45309', bar: '#F59E0B' };
    case 'error':
      return { label: 'Błąd', bg: '#FEF2F2', text: '#B91C1C', bar: '#EF4444' };
    case 'recorded':
    default:
      return { label: 'Nagrana', bg: '#F5F5F4', text: '#57534E', bar: '#A8A29E' };
  }
}

/* ─── animated list item ─── */
function NoteCard({
  item,
  index,
  onPress,
}: {
  item: NoteListItem;
  index: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const badge = getStatusMeta(item.status);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  return (
    <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}
      >
        {/* kolorowy pasek statusu */}
        <View style={[styles.statusBar, { backgroundColor: badge.bar }]} />

        {/* miniaturka */}
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbIcon}>📝</Text>
          </View>
        )}

        {/* treść */}
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>

          <Text style={styles.meta}>
            {formatTimestamp(item.recordedAt)}
            {item.durationMs ? `  ·  ${formatDuration(item.durationMs)}` : ''}
          </Text>

          <View style={styles.bottomRow}>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <View style={[styles.dot, { backgroundColor: badge.text }]} />
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
    </Animated.View>
  );
}

/* ─── main screen ─── */
export default function IndexScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const refresh = useCallback(async () => {
    try {
      const allNotes = await listNotes();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  // pulsowanie FAB co 3 s
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const onPullRefresh = () => {
    setRefreshing(true);
    void refresh();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dziennik terenowy</Text>
        <Text style={styles.headerSubtitle}>
          {new Date().toLocaleDateString('pl-PL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            notes.length === 0 ? styles.emptyContainer : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item, index }) => (
            <NoteCard
              item={item}
              index={index}
              onPress={() => router.push(`/detail?id=${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyCircle}>
                <Text style={styles.emptyIcon}>🎙️</Text>
              </View>
              <Text style={styles.emptyTitle}>Brak notatek</Text>
              <Text style={styles.emptySubtitle}>
                Twoje pierwsze nagranie czeka. Kliknij mikrofon poniżej, aby zacząć.
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <Animated.View style={[styles.fabWrap, { transform: [{ scale: pulse }] }]}>
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/record')}
        >
          <Text style={styles.fabIcon}>🎙️</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ─── styles ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 15,
    color: colors.muted,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  listContent: { padding: 20, paddingBottom: 120 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* karta */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    paddingVertical: 16,
    paddingRight: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  statusBar: {
    width: 3,
    alignSelf: 'stretch',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginRight: 16,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#F5F5F4',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: { fontSize: 26 },
  cardBody: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: '#A8A29E',
    fontWeight: '600',
  },
  bottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  errorHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },

  /* empty state */
  emptyState: { alignItems: 'center', paddingHorizontal: 20 },
  emptyCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#A8A29E',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    fontWeight: '500',
  },

  /* FAB */
  fabWrap: {
    position: 'absolute',
    right: 24,
    bottom: 32,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  fabPressed: {
    backgroundColor: '#115E59',
  },
  fabIcon: { fontSize: 28 },
});