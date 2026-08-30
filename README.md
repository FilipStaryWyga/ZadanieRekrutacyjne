# Notatnik Terenowy – AI-First Mobile App dla Rzeczoznawcy Samochodowego

Aplikacja mobilna stworzona dla rzeczoznawcy samochodowego pracującego w terenie, który podczas oględzin pojazdu nagrywa notatkę głosową i jednocześnie dokumentuje uszkodzenia fotografiami. Aplikacja rejestruje dokładny znacznik czasowy każdego zdjęcia względem nagrania, a następnie automatycznie przetwarza materiał przy użyciu modeli AI (OpenAI Whisper-1 oraz LLM), tworząc zwięzłe podsumowanie oraz transkrypcję z osadzonymi zdjęciami dokładnie w tych miejscach opisu, w których zostały zrobione.

---

## 1. Wybór Platformy

**Wybrana platforma:** **Android**  
*Uzasadnienie:* Aplikacja została zbudowana i przetestowana bezpośrednio na fizycznym urządzeniu z systemem Android połączonym przez USB w środowisku Expo SDK 57 (Managed Workflow z natywną obsługą `expo-audio` oraz `expo-camera`).

---

## 2. Architektura Danych i Strategia Offline-First

### Gdzie i jak długo przechowywane są surowe pliki?
- **Lokalizacja na urządzeniu:** Wszystkie surowe pliki audio (`audio.m4a`) oraz wykonane zdjęcia (`.jpg`) zapisywane są bezpośrednio w trwałym katalogu dokumentów aplikacji:
  ```text
  FileSystem.documentDirectory + 'notes/{noteId}/'
    ├── audio.m4a
    └── photos/
        ├── {photoId_1}.jpg
        └── {photoId_2}.jpg
  ```
- **Czas przechowywania:** Pliki są przechowywane **bezterminowo i trwale** na pamięci urządzenia. Wykorzystujemy katalog `Documents/`, a nie `Cache/`, dzięki czemu system operacyjny Android nigdy nie usunie nagrań ani zdjęć w ramach zwalniania pamięci tymczasowej.
- **Dostęp offline:** Nawet po pomyślnym przesłaniu i przetworzeniu przez backend, notatki wraz z podsumowaniem i transkrypcją są trwale zapisane w lokalnej bazie **SQLite** (`expo-sqlite`), umożliwiając natychmiastowe przeglądanie i odsłuch bez dostępu do Internetu.

---

## 3. Odporność na Błędy (Fail-Safe & Retry)

### Co się dzieje, gdy przetwarzanie padnie w połowie (brak sieci, timeout, błąd API)?
1. **Zero utraty danych lokalnych:** W przypadku jakiegokolwiek błędu na etapie wysyłki lub przetwarzania AI, lokalne pliki audio, zdjęcia oraz powiązane z nimi znaczniki czasu w SQLite pozostają w 100% nienaruszone.
2. **Czytelny stan i komunikat:** Status notatki przechodzi w stan `error` (`Wymaga ponowienia`), a w interfejsie użytkownika pojawia się ramka informacyjna z dokładną przyczyną błędu (np. brak klucza API, brak łączności z serwerem).
3. **Inteligentny Retry:** Przycisk **„Ponów przetwarzanie”** uruchamia idempotentny proces wznowienia:
   - Backend opiera się na operacjach `UPSERT` z unikalnymi identyfikatorami UUID wygenerowanymi na urządzeniu.
   - Aplikacja śledzi statusy wysłania poszczególnych zasobów (`audioUploaded`, `photo.uploaded`) i podczas ponowienia dosyła wyłącznie brakujące elementy, oszczędzając transfer i czas rzeczoznawcy.

---

## 4. Ekrany Aplikacji

1. **Lista notatek (`app/app/index.tsx`)**:
   - Prezentacja notatek od najnowszych (`recorded_at DESC`).
   - Tytuł, sformatowana data, czas trwania nagrania, miniatura pierwszego wykonanego zdjęcia.
   - Kolorystyczne badge statusów (`Nagrana`, `Wysyłanie…`, `Przetwarzanie AI…`, `Gotowa`, `Błąd`).
   - Obsługa gestu *Pull-to-Refresh* oraz automatyczne odświeżanie po powrocie z innych ekranów (`useFocusEffect`).

2. **Nowa notatka – Nagrywanie w terenie (`app/app/record.tsx`)**:
   - Możliwość podania tytułu i start nagrywania audio.
   - Równoległe wykonywanie zdjęć aparatem (`CameraView` z `shutterSound: false`) bez przerywania i zacinania strumienia audio.
   - Wyliczanie offsetu każdego zdjęcia (`offsetMs`) z zegara sesji nagrywania (`recorder.getStatus().durationMillis`).
   - Pasek miniatur wykonanych zdjęć z widocznymi znacznikami czasu (np. `00:42`).
   - Przycisk **„Zapisz”** natychmiast zapisuje całość w lokalnej bazie SQLite i pamięci trwałej (brak oczekiwania na sieć).

3. **Szczegóły notatki (`app/app/detail.tsx`)**:
   - **Odtwarzacz Audio:** Odsłuch zarejestrowanego nagrania (Play / Pause, czas odtwarzania, interaktywny pasek postępu).
   - **Przycisk „Przetwórz notatkę (AI)” / „Ponów”:** Uruchomienie pipeline'u przetwarzania z animowanym wskaźnikiem etapu.
   - **Podsumowanie AI:** Rzeczowe, zwięzłe podsumowanie ustaleń rzeczoznawcy wygenerowane przez model LLM.
   - **Oś czasu i transkrypcja ze zdjęciami:** Zintegrowany przebieg, w którym wypowiedzi rzeczoznawcy są podzielone na segmenty czasowe, a zdjęcia są pokazane dokładnie pod tekstem, o którym w danej chwili mówiono.
   - **Podgląd pełnoekranowy:** Możliwość powiększenia każdego zdjęcia po kliknięciu.

---

## 5. Stack Technologiczny

- **Aplikacja mobilna:**
  - React Native (Expo SDK 57, TypeScript, Managed Workflow)
  - Nawigacja: `expo-router`
  - Audio: `expo-audio`
  - Kamera: `expo-camera`
  - Baza danych lokalna: `expo-sqlite`
  - System plików: `expo-file-system`
- **Backend & Storage:**
  - Node.js + TypeScript + Fastify 5
  - Baza danych serwera: PostgreSQL 16 (migracje SQL)
  - Magazyn obiektowy: MinIO (S3-compatible storage)
  - Konteneryzacja: Docker & Docker Compose
- **Integracje AI:**
  - Transkrypcja ze znacznikami czasu: **OpenAI Whisper-1** (`verbose_json` ze skalowaniem do milisekund)
  - Podsumowanie notatek: **OpenAI GPT-4o-mini**
- **Testy:**
  - Vitest dla algorytmu przeplotu i tolerancji przerw w wypowiedziach (`server/test/interleave.test.ts`)

---

## 6. Instrukcja Uruchomienia

### Krok 1: Wymagania wstępne
- Zainstalowany **Node.js** (v20+) oraz **npm**
- Zainstalowany **Docker** i **Docker Compose**
- Aplikacja **Expo Go** lub środowisko Expo na telefonie Android

### Krok 2: Instalacja zależności
W katalogu głównym projektu:
```bash
npm install
```

### Krok 3: Konfiguracja zmiennych środowiskowych
Skopiuj plik `.env.example` do `.env` w głównym katalogu oraz `app/.env`:
```bash
cp .env.example .env
```

Uzupełnij klucz OpenAI w pliku `.env`:
```env
OPENAI_API_KEY=sk-...twoj-klucz-openai...
```

W `app/.env` upewnij się, że adres IP wskazuje na Twój komputer w sieci lokalnej (aby telefon z Androidem mógł połączyć się z backendem Fastify):
```env
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:3000
```
*(Jeśli testujesz przez adb reverse: `adb reverse tcp:3000 tcp:3000`, możesz użyć `http://localhost:3000`)*.

### Krok 4: Uruchomienie bazy danych i MinIO (Docker)
```bash
npm run docker:up
# lub bezpośrednio:
docker compose up -d postgres minio
```

### Krok 5: Uruchomienie Backend Fastify
```bash
npm run server
# lub: npm --workspace server run dev
```
Serwer uruchomi się na porcie `3000`, utworzy wymagany bucket w MinIO i połączy się z bazą Postgres.

### Krok 6: Uruchomienie aplikacji mobilnej
```bash
npm run app
# lub dla bezpośredniego startu na podłączonym Androidzie:
npm run android
```

### Krok 7: Uruchomienie testów jednostkowych
```bash
npm test
```

---

## 7. Świadomie Opisane Braki i Plan Dalszego Rozwoju (Next Steps)

1. **Wyszukiwarka pełnotekstowa (FTS5 w SQLite):**
   - Indeksacja transkrypcji w lokalnej bazie SQLite, umożliwiająca błyskawiczne wyszukiwanie notatek po słowach kluczowych (np. „zderzak”, „korozja”, „reflektor”).
2. **Background Sync z WorkManagerem:**
   - Wdrożenie natywnej kolejki synchronizacji w tle (`expo-background-fetch` / `WorkManager` na Androidzie), która automatycznie wysyła oczekujące notatki, gdy telefon odzyska stabilne połączenie Wi-Fi.
3. **Klasyfikacja uszkodzeń z Vision LLM (Multimodal):**
   - Dodanie analizy zdjęć przez GPT-4o Vision w celu automatycznego tagowania widocznych części pojazdu (np. „błotnik przedni lewy”) i weryfikacji spójności między opisem słownym a obrazem.
4. **Eksport do raportu PDF:**
   - Generowanie gotowego raportu PDF z logotypem firmy, metadanymi oględzin, podsumowaniem oraz tabelą zdjęć z podpisami do wysyłki do klienta/ubezpieczyciela.
