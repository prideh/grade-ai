# Render Deployment Runbook: Dauerhafte Speicherung für Scans und Uploads

## 1. Problemstellung & Ursachenanalyse (P0)

In der Produktionsumgebung auf Render werden Container bei jedem Deployment und bei jedem Service-Neustart vollständig neu initialisiert.

Standardmässig verwendet GradeAI den `FilesystemStorageAdapter`, welcher Dateien lokal unter `storage/uploads` im Anwendungsverzeichnis ablegt:

- **Auswirkung:** Jeder Render-Deploy oder Server-Neustart löscht alle im lokalen Container-Dateisystem gespeicherten Schüler-Scans und Prüfungsvorlagen.
- **Symptom:** In der Datenbank verbleiben die Einträge mit ihren `studentExamUrl`-Verweisen (Dangling References). Die Benutzeroberfläche zeigt anschliessend fehlerhafte Bildsymbole (404 Not Found), und die Daten können nicht mehr angezeigt werden.

---

## 2. Unterstützte dauerhafte Speicherlösungen

GradeAI unterstützt ab Werk zwei praxiserprobte und vollständig integrierte Persistenz-Optionen.

### Option A: S3-kompatibler Object Storage (Empfohlen für Skalierbarkeit)

Kompatibel mit Cloudflare R2, AWS S3, Backblaze B2, MinIO oder Wasabi.

> **Wichtiger Sicherheits- und Datenschutzhinweis:**
> Der S3-Bucket muss **privat** bleiben (kein öffentlicher Lesezugriff). Der Zugriff auf Schülerarbeiten erfolgt ausschliesslich über die authentifizierte GradeAI-Route `/uploads/...`, welche die aktive Lehrersitzung und den Klassenbesitz autorisiert.

#### Umgebungsvariablen für Option A:

| Variable               | Erforderlich     | Standardwert                | Beschreibung & Beispiele                                                                                                                                                                                          |
| ---------------------- | ---------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_DRIVER`       | Nein             | `s3` (wenn S3-Keys gesetzt) | Auf `s3` setzen, um den S3-Treiber explizit zu erzwingen.                                                                                                                                                         |
| `S3_BUCKET`            | **Ja**           | _keiner_                    | Name des privaten Buckets (z. B. `grade-ai-scans-prod`).                                                                                                                                                          |
| `S3_ACCESS_KEY_ID`     | **Ja**           | _keiner_                    | Access Key ID des Storage-Anbieters.                                                                                                                                                                              |
| `S3_SECRET_ACCESS_KEY` | **Ja**           | _keiner_                    | Secret Access Key des Storage-Anbieters.                                                                                                                                                                          |
| `S3_ENDPOINT`          | Anbieterabhängig | _AWS Default_               | Vollständige HTTPS-URL des S3-API-Endpoints.<br>- Cloudflare R2: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`<br>- Backblaze B2: `https://s3.<REGION>.backblazeb2.com`<br>- AWS S3: kann leer gelassen werden. |
| `S3_REGION`            | Nein             | `auto`                      | Region des Buckets (z. B. `auto` für R2, `eu-central-1` für AWS).                                                                                                                                                 |
| `S3_FORCE_PATH_STYLE`  | Nein             | `true`                      | `true` für Cloudflare R2, MinIO, Backblaze B2; `false` für AWS Virtual-Hosted Buckets.                                                                                                                            |

---

### Option B: Render Persistent Disk (Einfachste Infrastruktur ohne Cloud-Storage)

Render bietet die Möglichkeit, eine persistente Festplatte ("Persistent Disk") direkt an den Web Service zu hängen.

#### Umgebungsvariablen für Option B:

| Variable            | Erforderlich | Standardwert      | Beschreibung                                                                        |
| ------------------- | ------------ | ----------------- | ----------------------------------------------------------------------------------- |
| `STORAGE_LOCAL_DIR` | **Ja**       | `storage/uploads` | Einhängepfad ("Mount Path") der Render Persistent Disk (z. B. `/var/data/uploads`). |

---

## 3. Schritt-für-Schritt Runbook für das Deployment

Sobald die Entscheidung über den gewünschten Speicher-Anbieter gefallen ist, führen Sie folgende Schritte im Render Dashboard durch:

### Bei Verwendung von Option A (Cloudflare R2 / AWS S3):

1. Öffnen Sie das [Render Dashboard](https://dashboard.render.com).
2. Navigieren Sie zu Ihrem **GradeAI Web Service** -> **Environment**.
3. Fügen Sie die folgenden Umgebungsvariablen hinzu:
   ```text
   STORAGE_DRIVER=s3
   S3_BUCKET=grade-ai-scans-prod
   S3_ACCESS_KEY_ID=<Ihr-Access-Key>
   S3_SECRET_ACCESS_KEY=<Ihr-Secret-Key>
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_FORCE_PATH_STYLE=true
   ```
4. Klicken Sie auf **Save Changes**. Render löst automatisch ein Redeployment aus.
5. Prüfen Sie die Start-Logs des Services auf folgende Zeile:
   ```text
   [Storage] Aktiver Storage-Treiber: S3 (Bucket: "grade-ai-scans-prod", Endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com", Region: "auto")
   ```

### Bei Verwendung von Option B (Render Persistent Disk):

1. Öffnen Sie das [Render Dashboard](https://dashboard.render.com).
2. Navigieren Sie zu Ihrem **GradeAI Web Service** -> **Disks**.
3. Klicken Sie auf **Add Disk**:
   - **Name:** `grade-ai-uploads`
   - **Mount Path:** `/var/data/uploads`
   - **Size:** z. B. 10 GB (nach Bedarf anpassbar)
4. Navigieren Sie zu **Environment** und fügen Sie hinzu:
   ```text
   STORAGE_LOCAL_DIR=/var/data/uploads
   ```
5. Klicken Sie auf **Save Changes** und führen Sie ein Deployment durch.
6. Prüfen Sie die Start-Logs auf folgende Zeile:
   ```text
   [Storage] Aktiver Storage-Treiber: Filesystem (Verzeichnis: "/var/data/uploads")
   ```

---

## 4. Verifikation nach dem Deploy

Führen Sie zur Bestätigung folgenden Rauchtest durch:

1. Loggen Sie sich als Lehrperson ein und laden Sie eine neue Schülerarbeit hoch.
2. Öffnen Sie den Korrektur-Arbeitsbereich unter `/correct/<submissionId>` und überprüfen Sie, dass der Scan korrekt angezeigt wird.
3. Lösen Sie im Render Dashboard einen manuellen Redeploy aus ("Manual Deploy" -> "Deploy latest commit").
4. Rufen Sie nach Abschluss des Deploys dieselbe URL `/correct/<submissionId>` erneut auf.
5. **Erwartetes Ergebnis:** Der Originalscan wird weiterhin ohne Unterbrechung mit HTTP 200 ausgeliefert.

---

## 5. Zusätzliche Sicherheits- & Datenschutzgarantien

- **Zugriffssteuerung (#19):** Unberechtigte oder nicht angemeldete Anfragen auf `/uploads/<dateiname>` werden mit HTTP 401 bzw. HTTP 403 abgewiesen.
- **Kaskadierende Löschung (#30):** Wird eine Prüfung, eine Klasse oder ein Schüler gelöscht, entfernt GradeAI die entsprechenden Dateien über `storage.delete()` automatisch und unwiderruflich auch aus dem S3-Bucket oder von der persistenten Festplatte.
- **Startup-Warnung:** Läuft der Dienst im Produktionsmodus ohne S3 und ohne konfigurierte Persistent Disk, gibt GradeAI beim Start eine eindeutige Warnung im Log aus, um unbemerkten Datenverlust zu verhindern.
