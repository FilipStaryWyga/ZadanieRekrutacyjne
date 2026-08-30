import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { NoteRepository } from '../src/db/repository';
import { generateId } from '../src/lib/format';
import {
  saveToDocuments,
  buildPhotoFilename,
  buildAudioFilename,
} from '../src/lib/files';

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document',
} as const;

export default function RecordScreen() {
  const router = useRouter();
  const repository = new NoteRepository();

  const cameraRef = useRef<CameraView>(null);
  const noteIdRef = useRef(generateId());
  const [title, setTitle] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [durationMs, setDurationMs] = useState(0);

  // AUDIO SESSION: useAudioRecorder z zapisem do Documents/ (directory: 'document')
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (_status) => {
    // offset WYŁĄCZNIE z recorder.getStatus().durationMillis
    const status = recorder.getStatus();
    setDurationMs(status?.durationMillis ?? 0);
  });

  useEffect(() => {
    void requestCameraPermission();
    void Location.requestForegroundPermissionsAsync().then(({ status: s }) => {
      if (s === 'granted') {
        void Location.getCurrentPositionAsync({}).then(setLocation);
      }
    });
  }, [requestCameraPermission]);

  // CAMERA SESSION: zamontuj CameraView i poczekaj na onCameraReady,
  // dopiero wtedy można zaczynać nagrywanie.
  const handleRecord = async () => {
    if (!cameraReady) {
      Alert.alert('Kamera gotowa?', 'Poczekaj na inicjalizację kamery.');
      return;
    }
    if (recorder.isRecording) {
      await recorder.stop();
      return;
    }
    recorder.record();
  };

  const handleTakePhoto = async () => {
    if (!cameraReady) {
      Alert.alert('Kamera gotowa?', 'Poczekaj na inicjalizację kamery.');
      return;
    }
    if (!recorder.isRecording || !cameraRef.current) {
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });

    const photoId = generateId();
    const savedUri = await saveToDocuments(
      photo.uri,
      'photos',
      buildPhotoFilename(noteIdRef.current, photoId),
    );

    // offset zdjęcia wyliczany WYŁĄCZNIE z recorder.getStatus().durationMillis
    const status = recorder.getStatus();
    await repository.addPhoto({
      id: photoId,
      noteId: noteIdRef.current,
      localUri: savedUri,
      caption: null,
      offsetMs: status?.durationMillis ?? 0,
    });
  };

  const handleFinish = async () => {
    if (recorder.isRecording) {
      await recorder.stop();
    }

    const audioId = generateId();
    const audioUri = recorder.uri;
    if (!audioUri) {
      Alert.alert('Błąd', 'Brak nagrania audio do zapisania.');
      return;
    }

    const savedAudioUri = await saveToDocuments(
      audioUri,
      'audio',
      buildAudioFilename(noteIdRef.current, audioId),
    );

    await repository.createNote({
      id: noteIdRef.current,
      title: title.trim() || 'Notatka bez tytułu',
      recordedAt: Date.now(),
      latitude: location?.coords.latitude ?? null,
      longitude: location?.coords.longitude ?? null,
      locationName: null,
    });

    await repository.addAudio({
      id: audioId,
      noteId: noteIdRef.current,
      localUri: savedAudioUri,
      durationMs: recorder.getStatus()?.durationMillis ?? 0,
    });

    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Tytuł notatki"
        value={title}
        onChangeText={setTitle}
      />

      {!cameraPermission?.granted ? (
        <View style={styles.cameraPlaceholder}>
          <Pressable onPress={requestCameraPermission}>
            <Text style={styles.hint}>Przyznaj dostęp do kamery</Text>
          </Pressable>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />
      )}

      <Text style={styles.timer}>{Math.floor(durationMs / 1000)}s</Text>

      <View style={styles.controls}>
        <Pressable style={styles.button} onPress={handleTakePhoto}>
          <Text style={styles.buttonText}>Zdjęcie</Text>
        </Pressable>
        <Pressable
          style={[styles.recordButton, recorder.isRecording && styles.recording]}
          onPress={handleRecord}
        >
          <Text style={styles.buttonText}>
            {recorder.isRecording ? 'Stop' : 'Nagraj'}
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleFinish}>
          <Text style={styles.buttonText}>Zapisz</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  camera: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  cameraPlaceholder: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#e2e2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: '#2f6fdb', fontWeight: '600' },
  timer: {
    alignSelf: 'center',
    marginTop: 8,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
  },
  button: {
    backgroundColor: '#2f6fdb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  recordButton: {
    backgroundColor: '#d43f3f',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 36,
  },
  recording: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
