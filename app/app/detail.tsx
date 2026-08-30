import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { NoteRepository } from '../src/db/repository';
import type { DBPhoto } from '../src/db/types';
import { formatTimestamp, formatDuration } from '../src/lib/format';

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const repositoryRef = useRef(new NoteRepository());
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [recordedAt, setRecordedAt] = useState(0);
  const [photos, setPhotos] = useState<DBPhoto[]>([]);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const noteId = Array.isArray(id) ? id[0] : id;
      if (!noteId) return;

      const notes = await repositoryRef.current.getAllNotes();
      const note = notes.find((n) => n.id === noteId);

      if (note) {
        setTitle(note.title);
        setSummary(note.summary);
        setRecordedAt(note.recordedAt);
      }

      const notePhotos = await repositoryRef.current.getPhotosByNote(noteId);
      setPhotos(notePhotos);

      const audio = await repositoryRef.current.getAudioByNote(noteId);
      if (audio) {
        setDuration(audio.durationMs);
      }
    })();
  }, [id]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {formatTimestamp(recordedAt)} · audio {formatDuration(duration)}
      </Text>

      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      {!summary ? <Text style={styles.hint}>Brak podsumowania (oczekuje na przetworzenie)</Text> : null}

      <Text style={styles.section}>Zdjęcia</Text>
      {photos.length === 0 ? (
        <Text style={styles.hint}>Brak zdjęć</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          horizontal
          renderItem={({ item }) => (
            <Image source={{ uri: item.localUri }} style={styles.photo} />
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  meta: { color: '#666', marginTop: 6, fontSize: 14 },
  summary: {
    marginTop: 16,
    backgroundColor: '#eef3fb',
    borderRadius: 10,
    padding: 14,
  },
  hint: { color: '#888', marginTop: 8 },
  section: { marginTop: 24, fontSize: 18, fontWeight: '600' },
  photo: { width: 160, height: 160, borderRadius: 10, marginRight: 10 },
});
