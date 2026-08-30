import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { getNote, setStatus } from '../src/db/notes';
import type { Block, Note, NoteStatus, Photo } from '../src/db/types';
import { formatDuration, formatOffset, formatTimestamp } from '../src/lib/format';
import { processNotePipeline } from '../src/lib/api';
import { colors } from '../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getStatusBadge(status: NoteStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'ready':
      return { label: '✓ Gotowa (Przetworzona)', bg: '#ECFDF5', text: '#047857' };
    case 'processing':
      return { label: '⚙ Przetwarzanie AI…', bg: '#F5F3FF', text: '#6D28D9' };
    case 'uploading':
      return { label: '↑ Wysyłanie plików…', bg: '#FFFBEB', text: '#B45309' };
    case 'error':
      return { label: '✕ Wymaga ponowienia', bg: '#FEF2F2', text: '#B91C1C' };
    case 'recorded':
    default:
      return { label: '● Oczekuje na przetworzenie', bg: '#F5F5F4', text: '#57534E' };
  }
}

// ============================================================================
// Komponent Odtwarzacza Audio
// ============================================================================
function AudioPlayerCard({
  audioUri,
  durationMs,
}: {
  audioUri: string | null;
  durationMs: number | null;
}) {
  const player = useAudioPlayer(audioUri ?? null);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const currentTimeSec = status.currentTime ?? 0;
  const durationSec =
    status.duration > 0
      ? status.duration
      : durationMs
        ? durationMs / 1000
        : 0;

  const progressPercent =
    durationSec > 0 ? Math.min(100, (currentTimeSec / durationSec) * 100) : 0;

  const togglePlayback = () => {
    if (!audioUri) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleSeek = (ratio: number) => {
    if (durationSec > 0) {
      const targetSec = ratio * durationSec;
      player.seekTo(targetSec);
    }
  };

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerTopRow}>
        <Pressable
          style={[styles.playButton, !audioUri && styles.buttonDisabled]}
          onPress={togglePlayback}
          disabled={!audioUri}
        >
          <Text style={styles.playButtonIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>

        <View style={styles.playerInfo}>
          <Text style={styles.playerLabel}>
            {isPlaying ? 'Odtwarzanie nagrania' : 'Nagranie audio z terenu'}
          </Text>
          <Text style={styles.playerTimes}>
            {formatOffset(Math.round(currentTimeSec * 1000))} /{' '}
            {formatDuration(Math.round(durationSec * 1000))}
          </Text>
        </View>
      </View>

      {/* Pasek postępu */}
      <Pressable
        style={styles.progressBarBg}
        onPress={(e) => {
          const { locationX } = e.nativeEvent;
          const barWidth = SCREEN_WIDTH - 80;
          const ratio = Math.max(0, Math.min(1, locationX / barWidth));
          handleSeek(ratio);
        }}
      >
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </Pressable>
    </View>
  );
}

// ============================================================================
// Główny Ekran Szczegółów Notatki
// ============================================================================
export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const noteId = Array.isArray(id) ? id[0] : id;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatusLabel, setProcessStatusLabel] = useState<string>('');
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!noteId) return;
    try {
      const data = await getNote(noteId);
      setNote(data);
    } catch (err) {
      console.error('Błąd ładowania notatki:', err);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Uruchomienie pełnego pipeline'u przetwarzania
  const handleProcessNote = async () => {
    if (!noteId || isProcessing) return;

    setIsProcessing(true);
    setProcessStatusLabel('Wysyłanie plików do serwera…');

    try {
      await processNotePipeline(noteId, (status, msg) => {
        if (status === 'uploading') {
          setProcessStatusLabel('Wysyłanie notatki i zdjęć…');
        } else if (status === 'processing') {
          setProcessStatusLabel('Transkrypcja mowy (Whisper) i analiza AI…');
        } else if (status === 'ready') {
          setProcessStatusLabel('Zakończono!');
        } else if (status === 'error') {
          setProcessStatusLabel(msg ?? 'Wystąpił błąd');
        }
      });

      // Przeładowanie notatki z SQLite
      await loadData();
      Alert.alert('Sukces', 'Notatka została pomyślnie przetworzona przez AI!');
    } catch (err: any) {
      console.error('Błąd przetwarzania notatki:', err);
      Alert.alert(
        'Błąd przetwarzania',
        err.message ?? 'Nie udało się przetworzyć notatki. Surowe nagranie i zdjęcia są bezpieczne.',
      );
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || !note) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Ładowanie notatki…</Text>
      </View>
    );
  }

  const badge = getStatusBadge(note.status);
  const isReady = note.status === 'ready';
  const hasError = note.status === 'error';
  const isUnprocessed = note.status === 'recorded' || hasError;

  // Mapa zdjęć po ID dla szybkiego dostępu do lokalnego URI
  const photoMap = new Map<string, Photo>();
  note.photos.forEach((p) => photoMap.set(p.id, p));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Nagłówek notatki */}
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
          <Text style={styles.dateText}>{formatTimestamp(note.recordedAt)}</Text>
        </View>

        <Text style={styles.title}>{note.title}</Text>
      </View>

      {/* Odtwarzacz Audio */}
      <AudioPlayerCard audioUri={note.audioUri} durationMs={note.durationMs} />

      {/* Komunikat o błędzie (jeśli wystąpił) */}
      {hasError && note.errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxTitle}>⚠️ Błąd przetwarzania</Text>
          <Text style={styles.errorBoxText}>{note.errorMessage}</Text>
          <Text style={styles.errorBoxHint}>
            Surowe nagranie i zdjęcia są zachowane na telefonie. Możesz ponowić próbę w dowolnym momencie.
          </Text>
        </View>
      )}

      {/* Panel akcji przetwarzania */}
      <View style={styles.actionSection}>
        {isProcessing ? (
          <View style={styles.processingBox}>
            <ActivityIndicator size="small" color={colors.processing} />
            <Text style={styles.processingText}>{processStatusLabel}</Text>
          </View>
        ) : isUnprocessed ? (
          <Pressable style={styles.processButton} onPress={handleProcessNote}>
            <Text style={styles.processButtonText}>
              {hasError ? '🔄 Ponów przetwarzanie' : '🚀 Przetwórz notatkę (AI)'}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={styles.reprocessButton} onPress={handleProcessNote}>
            <Text style={styles.reprocessButtonText}>🔄 Przetwórz ponownie</Text>
          </Pressable>
        )}
      </View>

      {/* ===================================================================== */}
      {/* Widok Przetworzonej Notatki: Podsumowanie + Przebieg ze zdjęciami       */}
      {/* ===================================================================== */}
      {isReady && note.summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryIcon}>✨</Text>
            <Text style={styles.summaryTitle}>Podsumowanie ustaleń rzeczoznawcy</Text>
          </View>
          <Text style={styles.summaryContent}>{note.summary}</Text>
        </View>
      )}

      {isReady && note.blocks && note.blocks.length > 0 ? (
        <View style={styles.timelineSection}>
          <Text style={styles.sectionHeading}>Przebieg oględzin i dokumentacja</Text>
          <Text style={styles.sectionSubheading}>
            Zdjęcia są przypisane do fragmentów wypowiedzi w momencie ich wykonania.
          </Text>

          <View style={styles.timelineList}>
            {note.blocks.map((block, index) => {
              if (block.type === 'paragraph') {
                return (
                  <View key={`seg-${index}`} style={styles.transcriptBlock}>
                    <View style={styles.transcriptTimeRow}>
                      <Text style={styles.transcriptTimeBadge}>
                        ⏱ {formatOffset(block.startMs ?? 0)} – {formatOffset(block.endMs ?? 0)}
                      </Text>
                    </View>
                    <Text style={styles.transcriptText}>{block.text}</Text>
                  </View>
                );
              }

              if (block.type === 'photo') {
                const photoObj = photoMap.get(block.photoId);
                const displayUri = photoObj?.uri ?? block.uri;

                return (
                  <View key={`photo-${index}`} style={styles.photoBlock}>
                    <View style={styles.photoBlockHeader}>
                      <View style={styles.photoTimeBadge}>
                        <Text style={styles.photoTimeBadgeText}>
                          📷 Zdjęcie zrobione w {formatOffset(block.atMs)}
                        </Text>
                      </View>
                    </View>

                    {displayUri ? (
                      <Pressable onPress={() => setSelectedPhotoUri(displayUri)}>
                        <Image source={{ uri: displayUri }} style={styles.timelinePhoto} />
                      </Pressable>
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoPlaceholderText}>Brak podglądu pliku</Text>
                      </View>
                    )}
                  </View>
                );
              }

              return null;
            })}
          </View>
        </View>
      ) : null}

      {/* ===================================================================== */}
      {/* Widok Nieprzetworzonej Notatki: Galeria wykonanych zdjęć               */}
      {/* ===================================================================== */}
      {!isReady && (
        <View style={styles.gallerySection}>
          <Text style={styles.sectionHeading}>
            Zarejestrowane zdjęcia ({note.photos.length})
          </Text>
          <Text style={styles.sectionSubheading}>
            Kliknij „Przetwórz notatkę”, aby wygenerować transkrypcję i powiązać zdjęcia ze słowami.
          </Text>

          {note.photos.length === 0 ? (
            <View style={styles.emptyPhotosBox}>
              <Text style={styles.emptyPhotosText}>Brak wykonanych zdjęć do tego nagrania.</Text>
            </View>
          ) : (
            <View style={styles.photosGrid}>
              {note.photos.map((photo) => (
                <Pressable
                  key={photo.id}
                  style={styles.gridPhotoContainer}
                  onPress={() => setSelectedPhotoUri(photo.uri)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.gridPhoto} />
                  <View style={styles.gridPhotoBadge}>
                    <Text style={styles.gridPhotoBadgeText}>{formatOffset(photo.offsetMs)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ===================================================================== */}
      {/* Modal powiększenia zdjęcia                                            */}
      {/* ===================================================================== */}
      <Modal
        visible={selectedPhotoUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoUri(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalCloseButton} onPress={() => setSelectedPhotoUri(null)}>
            <Text style={styles.modalCloseText}>✕ Zamknij</Text>
          </Pressable>

          {selectedPhotoUri && (
            <Image
              source={{ uri: selectedPhotoUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================================
// Style ekranu
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.muted,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dateText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  // Odtwarzacz
  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F5F5F4',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  playerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonIcon: {
    color: '#fff',
    fontSize: 22,
  },
  playerInfo: {
    flex: 1,
  },
  playerLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  playerTimes: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F5F5F4',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  // Akcje i błędy
  actionSection: {
    marginBottom: 24,
  },
  processButton: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  reprocessButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  reprocessButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#E9E5FF',
    padding: 18,
    borderRadius: 16,
    gap: 12,
  },
  processingText: {
    color: colors.processing,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  errorBoxTitle: {
    color: '#991B1B',
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 6,
  },
  errorBoxText: {
    color: '#7F1D1D',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  errorBoxHint: {
    color: '#B91C1C',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // Podsumowanie AI
  summaryCard: {
    backgroundColor: '#F0FDFA',
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  summaryIcon: {
    fontSize: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  summaryContent: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 24,
    fontWeight: '500',
  },
  // Oś czasu i transkrypcja
  timelineSection: {
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sectionSubheading: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 20,
    lineHeight: 20,
    fontWeight: '500',
  },
  timelineList: {
    gap: 16,
  },
  transcriptBlock: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5F5F4',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  transcriptTimeRow: {
    marginBottom: 8,
  },
  transcriptTimeBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A8A29E',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    fontWeight: '500',
  },
  photoBlock: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  photoBlockHeader: {
    marginBottom: 10,
  },
  photoTimeBadge: {
    backgroundColor: '#F0FDFA',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  photoTimeBadgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timelinePhoto: {
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
  photoPlaceholder: {
    height: 160,
    backgroundColor: '#F5F5F4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  // Galeria nieprzetworzona
  gallerySection: {
    marginTop: 4,
  },
  emptyPhotosBox: {
    padding: 28,
    backgroundColor: colors.surface,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5F5F4',
  },
  emptyPhotosText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '500',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridPhotoContainer: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: (SCREEN_WIDTH - 52) / 2 * 1.1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
  },
  gridPhotoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gridPhotoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // Modal powiększenia
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    zIndex: 10,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});