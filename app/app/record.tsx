import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import { addPhoto, createNote, finishRecording } from '../src/db/notes';
import type { Photo } from '../src/db/types';
import { formatOffset, generateId } from '../src/lib/format';
import { saveAudioFile, savePhotoFile } from '../src/lib/files';
import { colors } from '../src/theme';

export default function RecordScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const noteIdRef = useRef(generateId());

  const [title, setTitle] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  // Krok A: Inicjalizacja trybu audio (mixWithOthers, allowsRecording, playsInSilentMode)
  // oraz sprawdzenie i zapytanie o uprawnienia do mikrofonu i kamery.
  useEffect(() => {
    let isMounted = true;

    async function initAudioAndPermissions() {
      try {
        await setAudioModeAsync({
          interruptionMode: 'mixWithOthers',
          allowsRecording: true,
          playsInSilentMode: true,
        });

        const audioStatus = await getRecordingPermissionsAsync();
        if (audioStatus.granted) {
          if (isMounted) setHasAudioPermission(true);
        } else {
          const reqAudio = await requestRecordingPermissionsAsync();
          if (isMounted) setHasAudioPermission(reqAudio.granted);
        }

        if (!cameraPermission?.granted) {
          await requestCameraPermission();
        }
      } catch (err) {
        console.error('Błąd inicjalizacji audio/uprawnień:', err);
      }
    }

    void initAudioAndPermissions();

    // Fallback timeout 2.5s: jeśli aparat nie wywoła onCameraReady,
    // odblokowujemy możliwość nagrywania
    const cameraTimeout = setTimeout(() => {
      if (isMounted) {
        setCameraReady(true);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(cameraTimeout);
    };
  }, []);

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  // KROK D: Start nagrania
  // 1. Upewnienie się o audio mode
  // 2. Utworzenie pustego rekordu notatki w SQLite (aby zdjęcia z FK mogły się zapisywać natychmiast)
  // 3. prepareToRecordAsync() -> record()
  const handleStartRecording = async () => {
    if (!hasAudioPermission) {
      const req = await requestRecordingPermissionsAsync();
      setHasAudioPermission(req.granted);
      if (!req.granted) {
        Alert.alert('Brak uprawnień', 'Dostęp do mikrofonu jest wymagany do nagrania notatki.');
        return;
      }
    }

    if (!cameraPermission?.granted) {
      const camReq = await requestCameraPermission();
      if (!camReq.granted) {
        Alert.alert('Brak uprawnień', 'Dostęp do aparatu jest wymagany.');
        return;
      }
    }

    try {
      // Potwierdzenie konfiguracji sesji audio przed nagraniem
      await setAudioModeAsync({
        interruptionMode: 'mixWithOthers',
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Zapisujemy szkielet notatki w lokalnej bazie SQLite
      await createNote({
        id: noteIdRef.current,
        title: title.trim(),
      });

      // Przygotowanie i start nagrywarki audio
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecordingActive(true);
    } catch (err) {
      console.error('Błąd podczas uruchamiania nagrywania:', err);
      Alert.alert('Błąd nagrywania', 'Nie udało się wystartować nagrania dźwięku.');
    }
  };

  // Wykonywanie zdjęcia w trakcie nagrywania:
  // - shutterSound: false (wyłączenie dźwięku migawki, aby nie wszedł do nagrania)
  // - offset_ms wyłącznie z recorder.getStatus().durationMillis
  // - natychmiastowy zapis pliku i rekordu do SQLite
  // - sprawdzenie isRecording po wykonaniu zdjęcia
  const handleTakePhoto = async () => {
    if (!isRecordingActive || !recorderState.isRecording) {
      Alert.alert('Uwaga', 'Zdjęcia można robić tylko w trakcie aktywnego nagrywania.');
      return;
    }

    if (!cameraRef.current) {
      Alert.alert('Błąd', 'Aparat nie jest dostępny.');
      return;
    }

    setIsCapturingPhoto(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        shutterSound: false,
      });

      if (!photo?.uri) {
        console.warn('Aparat nie zwrócił URI zdjęcia');
        return;
      }

      // Offset czasowy zdjęcia liczony wyłącznie ze statusu nagrywarki
      const status = recorder.getStatus();
      const offsetMs = Math.max(0, status?.durationMillis ?? recorderState.durationMillis ?? 0);

      const photoId = generateId();
      const currentNoteId = noteIdRef.current;

      // Zapis zdjęcia w katalogu Documents
      const savedUri = await savePhotoFile(currentNoteId, photoId, photo.uri);

      // Natychmiastowy zapis do bazy SQLite
      const savedPhoto = await addPhoto({
        id: photoId,
        noteId: currentNoteId,
        uri: savedUri,
        offsetMs,
      });

      setPhotos((prev) => [...prev, savedPhoto]);

      // Kontrola ciągłości nagrania: jeśli system przerwał sesję audio,
      // natychmiast zabezpieczamy to, co zostało nagrane
      const postStatus = recorder.getStatus();
      if (!postStatus?.isRecording && !recorderState.isRecording) {
        console.warn('Wykryto przerwanie sesji audio po wykonaniu zdjęcia');
        Alert.alert(
          'Przerwanie nagrania',
          'System zatrzymał nagrywanie dźwięku. Zapisujemy dotychczas zarejestrowany materiał.',
        );
        await handleFinish();
      }
    } catch (err) {
      console.error('Błąd podczas wykonywania zdjęcia:', err);
      Alert.alert('Błąd aparatu', 'Nie udało się zrobić zdjęcia.');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  // Zakończenie nagrania:
  // - stop nagrywarki
  // - przeniesienie audio do Documents/<noteId>/audio.m4a
  // - aktualizacja rekordu w SQLite (finishRecording)
  // - ZERO operacji sieciowych
  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    try {
      const finalDuration =
        recorder.getStatus()?.durationMillis ?? recorderState.durationMillis ?? 0;

      if (recorder.isRecording || recorderState.isRecording) {
        try {
          await recorder.stop();
        } catch (stopErr) {
          console.warn('Błąd zatrzymania nagrywarki:', stopErr);
        }
      }

      const audioSourceUri = recorder.uri ?? recorderState.url;
      if (!audioSourceUri) {
        Alert.alert('Błąd', 'Brak zarejestrowanego pliku audio.');
        setIsFinishing(false);
        return;
      }

      const currentNoteId = noteIdRef.current;

      // Kopiowanie pliku audio do stałego katalogu Documents
      const persistentAudioUri = await saveAudioFile(currentNoteId, audioSourceUri);

      // Aktualizacja bazy SQLite z finalnym tytułem, ścieżką audio i czasem trwania
      await finishRecording({
        noteId: currentNoteId,
        title: title.trim() || 'Notatka bez tytułu',
        audioUri: persistentAudioUri,
        durationMs: Math.max(finalDuration, 1000),
      });

      // Powrót do listy notatek
      router.replace('/');
    } catch (err) {
      console.error('Błąd zapisu notatki:', err);
      Alert.alert('Błąd zapisu', 'Nie udało się zapisać notatki w pamięci urządzenia.');
      setIsFinishing(false);
    }
  };

  const isRecording = isRecordingActive && recorderState.isRecording;
  const currentDurationMs = recorderState.durationMillis ?? 0;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Tytuł notatki (opcjonalny)"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
        editable={!isFinishing}
      />

      {/* Podgląd kamery / Banner uprawnień */}
      <View style={styles.cameraContainer}>
        {!cameraPermission?.granted ? (
          <View style={styles.permissionPlaceholder}>
            <Text style={styles.permissionTitle}>Wymagany dostęp do aparatu</Text>
            <Text style={styles.permissionSubtitle}>
              Aparat umożliwia dokumentację fotograficzną podczas nagrywania notatki.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestCameraPermission}>
              <Text style={styles.permissionButtonText}>Przyznaj dostęp</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="picture"
            onCameraReady={handleCameraReady}
          >
            {/* Nakładka czasu nagrania */}
            {isRecording && (
              <View style={styles.overlay}>
                <View style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>REC</Text>
                </View>
                <Text style={styles.timer}>{formatOffset(currentDurationMs)}</Text>
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountText}>📷 {photos.length}</Text>
                </View>
              </View>
            )}
          </CameraView>
        )}
      </View>

      {/* Pasek zrobionych zdjęć */}
      {photos.length > 0 && (
        <View style={styles.photosStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoThumbContainer}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                <View style={styles.photoTimeBadge}>
                  <Text style={styles.photoTimeText}>{formatOffset(photo.offsetMs)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Panel kontrolny */}
      <View style={styles.controls}>
        {!isRecording ? (
          <Pressable
            style={[styles.mainButton, styles.startButton]}
            onPress={handleStartRecording}
            disabled={isFinishing}
          >
            <Text style={styles.mainButtonText}>Rozpocznij nagrywanie</Text>
          </Pressable>
        ) : (
          <View style={styles.activeControls}>
            {/* Przycisk Zrób zdjęcie */}
            <Pressable
              style={[styles.actionButton, styles.photoButton, isCapturingPhoto && styles.buttonDisabled]}
              onPress={handleTakePhoto}
              disabled={isCapturingPhoto || isFinishing}
            >
              {isCapturingPhoto ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>📷 Zdjęcie</Text>
              )}
            </Pressable>

            {/* Przycisk Zakończ i zapisz */}
            <Pressable
              style={[styles.actionButton, styles.finishButton, isFinishing && styles.buttonDisabled]}
              onPress={handleFinish}
              disabled={isFinishing}
            >
              {isFinishing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>✓ Zapisz</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  permissionPlaceholder: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.recording,
  },
  recText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  timer: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  photoCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photosStrip: {
    height: 74,
    marginTop: 10,
  },
  photoThumbContainer: {
    marginRight: 8,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  photoTimeBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 4,
    paddingVertical: 1,
    alignItems: 'center',
  },
  photoTimeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    marginTop: 14,
    marginBottom: 8,
  },
  mainButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: colors.recording,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  activeControls: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButton: {
    backgroundColor: colors.accent,
  },
  finishButton: {
    backgroundColor: colors.ready,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

