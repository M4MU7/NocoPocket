<p align="center">
  <img src="assets/icon.png" alt="NocoPocket" width="128" />
</p>

<h1 align="center">NocoPocket</h1>

<p align="center">
  Mobilny klient <a href="https://nocodb.com">NocoDB</a> na Androida – przeglądaj, dodawaj, edytuj i usuwaj rekordy swoich baz prosto z telefonu.
</p>

<p align="center">
  <a href="https://github.com/M4MU7/NocoPocket/releases/latest"><b>⬇ Pobierz najnowszy APK</b></a>
</p>

---

## Funkcje

- **Bazy i tabele** – lista baz ze wszystkich dostępnych workspace'ów i tabel w każdej bazie, z liczbą rekordów.
- **Przypięte tabele** – najczęściej używane tabele na ekranie startowym, bez przechodzenia przez bazę.
- **Widok tabeli** – pole główne przypięte przy przewijaniu w bok, wyszukiwanie po polu głównym, sortowanie po dotknięciu nagłówka kolumny i doczytywanie kolejnych stron podczas przewijania.
- **Widok Kanban** – rekordy pogrupowane w kolumny według pola typu SingleSelect (np. „Status”), z kolorami opcji z NocoDB. Dwa układy do wyboru dla każdej tabeli: kolumny **w bok** albo **z góry na dół** (zwijane). Przytrzymanie karty przenosi ją do innej kolumny, a „+” w kolumnie tworzy rekord z jej statusem.
- **Szczegóły rekordu** – najważniejsze pola jako kafelki, kolorowe etykiety wyboru, gwiazdki oceny, pasek postępu, daty w czasie lokalnym.
- **Dodawanie i edycja** – formularz dopasowany do typu pola, z oznaczeniem zmienionych pól i walidacją przed wysłaniem. Przy edycji wysyłane są tylko zmienione pola.
- **Usuwanie** – z potwierdzeniem przed usunięciem.
- **Powiązania między tabelami** – pola Links i LinkToAnotherRecord pokazują powiązane rekordy (dotknięcie otwiera rekord z drugiej tabeli). W formularzu możesz dodawać i odłączać powiązania, wybierając rekordy z wyszukiwarką.
- **Motyw jasny, ciemny lub zgodny z systemem** oraz test połączenia z serwerem w ustawieniach.

### Obsługiwane typy pól

| Edytowalne | Tylko do odczytu |
| --- | --- |
| SingleLineText, LongText, Email, URL, PhoneNumber | Lookup, Rollup, Formula |
| Number, Decimal, Currency, Percent, Year | Attachment, User, CreatedBy, LastModifiedBy |
| Rating, Checkbox | CreatedTime, LastModifiedTime, AutoNumber |
| SingleSelect, MultiSelect | Barcode, QrCode, Duration, Geometry |
| Date, DateTime, Time, JSON | |
| Links, LinkToAnotherRecord | |

## Wymagania

- Android 7.0 (API 24) lub nowszy, procesor ARM (`arm64-v8a` lub `armeabi-v7a`).
- Instancja NocoDB z **API v3** (aplikacja powstała pod NocoDB 2026.09.x; self-hosted lub NocoDB Cloud).
- Token API NocoDB.

## Instalacja

1. Pobierz plik `NocoPocket-vX.Y.Z.apk` z zakładki [Releases](https://github.com/M4MU7/NocoPocket/releases/latest).
2. *(Opcjonalnie)* Sprawdź sumę kontrolną SHA-256 podaną w opisie wydania:
   ```bash
   certutil -hashfile NocoPocket-v1.2.0.apk SHA256   # Windows
   sha256sum NocoPocket-v1.2.0.apk                   # Linux / macOS
   ```
3. Otwórz plik na telefonie i zezwól na instalację z tego źródła, gdy Android o to zapyta.

## Konfiguracja

Przy pierwszym uruchomieniu aplikacja pokaże ekran **Połącz z NocoDB**: podaj adres serwera i token API ([jak go utworzyć](https://docs.nocodb.com/account-settings/api-tokens/)). Workspace ustawisz w „Ustawieniach zaawansowanych”. Połączenie jest sprawdzane przed zapisaniem danych.

Później wszystko zmienisz w **Ustawieniach** (ikona suwaków na ekranie startowym):

| Ustawienie | Opis |
| --- | --- |
| **Adres serwera** | Adres Twojej instancji NocoDB, np. `https://nocodb.example.com` |
| **Token API** | Token wygenerowany w NocoDB (`xc-token`) |
| **Workspace** | `default` pobiera bazy ze wszystkich dostępnych workspace'ów; możesz też podać konkretne ID |
| **Testuj** | Sprawdza połączenie z wpisanymi danymi, zanim je zapiszesz |
| **Motyw** | Jasny, ciemny albo zgodny z ustawieniem telefonu |
| **Kolumny Kanbana** | Pole SingleSelect, według którego grupowany jest Kanban (domyślnie `Status`). Gdy tabela go nie ma, dostępny jest tylko widok tabeli |
| **Tytuł rekordu** | Pole używane jako tytuł rekordu; gdy tabela go nie ma, używane jest pole główne |
| **Opis na karcie Kanbana** / **Długość opisu** | Pole pokazywane pod tytułem na kartach Kanbana i limit jego znaków |
| **Rekordów na stronę** | Ile rekordów pobierać naraz w widoku tabeli (25–500) |

## Bezpieczeństwo i prywatność

- Aplikacja łączy się **wyłącznie z Twoim serwerem NocoDB** – nie ma analityki ani zewnętrznych usług.
- URL i token są przechowywane lokalnie na telefonie (AsyncStorage, bez dodatkowego szyfrowania). Najlepiej użyj tokena konta z uprawnieniami ograniczonymi do potrzebnych baz.
- Aplikacja pozwala na połączenia HTTP (np. w sieci lokalnej), ale do połączeń przez internet zalecany jest **HTTPS**.
- **Ustawienia → Usuń dane logowania z telefonu** kasuje adres serwera, token i przypięte tabele (dane w NocoDB pozostają bez zmian).

## Ograniczenia

- Pola wyliczane i złożone (Lookup, Rollup, formuły, załączniki, użytkownicy itp.) są tylko do odczytu.
- Daty wpisuje się tekstowo (`RRRR-MM-DD`, `RRRR-MM-DD GG:MM`, `GG:MM`) – z przyciskami „Dziś” / „Teraz”, bez kalendarza.
- Widok tabeli ma wyszukiwanie po polu głównym i sortowanie, ale nie ma jeszcze filtrów według dowolnych pól.
- Interfejs jest dostępny tylko po polsku.
- Projekt jest skonfigurowany tylko dla Androida.

## Budowanie ze źródeł

Wymagania: Node.js ≥ 20.19.4, JDK 17 oraz Android SDK (NDK i CMake doinstaluje Gradle).

```bash
npm install
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Gotowy plik: `android/app/build/outputs/apk/release/app-release.apk`.

## Struktura projektu

```
src/
├── components/   # widok tabeli, Kanban (dwa układy), szczegóły rekordu, formularz, wybór powiązań, wspólne elementy UI
├── context/      # ustawienia i przypięte tabele zapisywane na urządzeniu
├── hooks/        # pobieranie baz, tabel, schematu, rekordów i liczby rekordów
├── screens/      # ekrany: połączenie, start, tabele w bazie, tabela/Kanban, ustawienia
├── services/     # klient NocoDB REST API v3
├── theme/        # motyw jasny/ciemny/systemowy i typografia
└── utils/        # formatowanie i walidacja wartości wg typu pola
```

## Technologie

[Expo](https://expo.dev) SDK 54 · [React Native](https://reactnative.dev) 0.81 · [React Navigation](https://reactnavigation.org) 7 · [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) · [NocoDB REST API v3](https://nocodb.com/apis/v3/data)

Font [Manrope](https://fonts.google.com/specimen/Manrope) (SIL Open Font License) · ikony [Feather](https://feathericons.com) (MIT) przez [@expo/vector-icons](https://docs.expo.dev/guides/icons/)

---

<sub>NocoPocket jest niezależnym projektem i nie jest powiązany z NocoDB Inc. „NocoDB” jest znakiem towarowym jego właściciela.</sub>
