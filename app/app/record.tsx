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
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { addPhoto, createNote, finishRecording } from '../src/db/notes';
import { formatOffset, generateId } from '../src/lib/format';
import { saveAudioFile, savePhotoFile } from '../src/lib/files';
import { colors } from '../src/theme';

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document',
} as const;

export default function RecordScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const noteIdRef = useRef(generateId());
  const [title, setTitle] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [durationMs, setDurationMs] = useState(0);

  const recorder = useAudioRecorder(RECORDING_OPTIONS, () => {
    const status = recorder.getStatus();
    setDurationMs(status?.durationMillis ?? 0);
  });

  useEffect(() => {
    void requestCameraPermission();
  }, [requestCameraPermission]);

  const handleRecord = async () => {
    if (!cameraReady) {
      Alert.alert('Kamera gotowa?', 'Poczekaj na inicjalizację kamery.');
      return;
    }
    if (recorder.isRecording) {
      await recorder.stop();
      return;
    }
    await createNote({ id: noteIdRef.current, title });
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
    if (!photo?.uri) {
      return;
    }

    const photoId = generateId();
    const savedUri = await savePhotoFile(noteIdRef.current, photoId, photo.uri);
    const status = recorder.getStatus();
    await addPhoto({
      id: photoId,
      noteId: noteIdRef.current,
      uri: savedUri,
      offsetMs: status?.durationMillis ?? 0,
    });
  };

  const handleFinish = async () => {
    if (recorder.isRecording) {
      await recorder.stop();
    }

    const audioUri = recorder.uri;
    if (!audioUri) {
      Alert.alert('Błąd', 'Brak nagrania audio do zapisania.');
      return;
    }

    await createNote({ id: noteIdRef.current, title });
    const savedAudioUri = await saveAudioFile(noteIdRef.current, audioUri);
    await finishRecording({
      noteId: noteIdRef.current,
      title,
      audioUri: savedAudioUri,
      durationMs: recorder.getStatus()?.durationMillis ?? durationMs,
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

      <Text style={styles.timer}>{formatOffset(durationMs)}</Text>

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
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: colors.text,
  },
  camera: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  cameraPlaceholder: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: colors.accent, fontWeight: '600' },
  timer: {
    alignSelf: 'center',
    marginTop: 8,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  recordButton: {
    backgroundColor: colors.recording,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 36,
  },
  recording: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
