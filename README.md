# Markdown Auto Sync (Google Workspace Add-on)

> 🇰🇷 **한국어 안내**: 이 문서의 아래쪽 섹션에 **[한국어 설명](#-한국어-안내-korean-guide)**이 포함되어 있습니다.  
> 🌐 **Language Notice**: Korean documentation is available in the **[lower section of this document](#-한국어-안내-korean-guide)**.

---

# English Guide

An enterprise-ready **Google Workspace Add-on** for **Google Docs** that automatically converts your documents into standard GitHub Flavored Markdown (`.md`) files and saves or synchronizes them directly in the **exact same Google Drive folder**.

Engineered to strictly comply with Google Workspace Marketplace policies and Google API Limited Use guidelines.

---

## 🚀 Key Features and Architecture

1. **Google Workspace Marketplace Compliance**
   - **Hourly Background Scheduler (`everyHours(1)`)**: Conforms strictly to Google's Add-on policy forbidding sub-hour (minute-based) time-driven triggers, eliminating review rejection risks.
   - **Handling Docs Event Limitations**: Because Google Docs does not support real-time `onEdit` triggers, we provide a reliable hybrid architecture: **instant manual sync via sidebar + 1-hour background scheduler**.

2. **Responsive Sidebar UX (`CardService`) & Multi-Language Support**
   - **Real-time Korean / English Language Toggle**: Switch between languages instantly with the top button (`🌐 Switch to English` / `🌐 한국어로 전환`) or the 3-dots (⋮) menu. Language preferences are permanently saved to your Google account (`UserProperties`).
   - **Primary Action [⚡ Sync Now (.md)]**: Positioned at the very top of the sidebar for immediate one-click synchronization.
   - **ActionResponse Feedback**: Returns interactive responses with `setNotification()` for immediate toast popups and `setNavigation(CardService.newNavigation().updateCard(...))` to reload current sync timestamps, filenames, and scheduler statuses.

3. **Safe Drive Parent Folder Traversal & OAuth Stability**
   - Uses `https://www.googleapis.com/auth/drive` to reliably locate the document's parent folder (`getParents()`) even on existing documents, avoiding runtime `drive.file` permission exceptions.
   - If `[DocumentTitle].md` exists, its content is updated via `setContent()`; otherwise, it is created anew via `createFile()`.

4. **Concurrency Control (`LockService`)**
   - Employs a 10-second wait lock (`LockService.getDocumentLock()` / `getUserLock()`) to prevent race conditions and file corruption when manual and background syncs overlap.

5. **Precision Markdown Conversion Engine**
   - **Headings**: Title, Subtitle, and Heading 1 through 6.
   - **Inline Formatting & Space Isolation**: Bold (`**text**`), Italic (`*text*`), Strikethrough (`~~text~~`), Monospace/Code (`` `code` ``), and Hyperlinks. Separates leading/trailing whitespaces from formatting markers to prevent broken Markdown parsing.
   - **Lists**: Bulleted (`- `) and numbered (`1. `) lists with preserved nested indentation (2 spaces per level).
   - **Tables**: GitHub Flavored Markdown (GFM) tables (`| Header | ... |`) with cell line breaks replaced by `<br>` and pipe (`|`) characters escaped.
   - **Horizontal Rules**: `---` support.

---

## 📂 Project Structure

```text
auto_markdown/
├── Code.gs            # Add-on source code (UI, scheduler, Markdown engine, Drive I/O)
├── appsscript.json    # Manifest (V8 runtime, OAuth scopes, addOns configuration)
├── PRIVACY.md         # Privacy Policy for Marketplace submission
├── TERMS.md           # Terms of Service for Marketplace submission
└── README.md          # Dual-language documentation & setup guide
```

---

## 🔐 OAuth Scopes (`appsscript.json`)

| Scope | Purpose |
| :--- | :--- |
| `https://www.googleapis.com/auth/documents.currentonly` | Read the text and styles of the active Google Doc. |
| `https://www.googleapis.com/auth/drive` | Locate the parent folder and create/update `.md` files in the same directory. |
| `https://www.googleapis.com/auth/script.scriptapp` | Create and manage the 1-hour background sync scheduler. |
| `https://www.googleapis.com/auth/script.container.ui` | Render the sidebar interface and handle interactive action responses. |

---

## 🛠️ Installation & Testing

### Option 1. Direct Testing in Google Docs (Container-Bound)

1. Open the **Google Docs** document you want to test with.
2. In the top menu, navigate to **Extensions > Apps Script**.
3. Click the gear icon (**Project Settings**) on the left and check **"Show 'appsscript.json' manifest file in editor"**.
4. Paste the contents of [`appsscript.json`](./appsscript.json) into the editor's manifest and save (`Ctrl + S`).
5. Paste the contents of [`Code.gs`](./Code.gs) into `Code.gs` and save (`Ctrl + S`).
6. Refresh the Google Docs page (F5) to access the sidebar and top menu.

### Option 2. Using clasp CLI

```bash
# Push files to Google Apps Script
clasp push
```

---

## 📝 User Guide

1. **Instant Sync**:
   - Edit your Google Doc and click **[⚡ Sync Now (.md)]** at the top of the sidebar.
   - A `.md` file is instantly generated or updated in the same Google Drive folder.
2. **Enable Background Sync**:
   - Click **[Turn On Auto Sync (Hourly)]** to register an automated background sync that runs every hour.
3. **Disable Background Sync**:
   - Click **[Turn Off Auto Sync (OFF)]** to remove all scheduled background triggers.

---
---

# 🇰🇷 한국어 안내 (Korean Guide)

Google Docs(구글 문서)의 내용을 표준 마크다운(`.md`) 파일로 자동 변환하여, 해당 문서가 위치한 Google Drive의 **동일한 폴더**에 자동으로 생성 및 동기화해 주는 Google Workspace Add-on 프로젝트입니다.

Google Workspace Marketplace(마켓플레이스) 배포 가이드라인 및 보안 정책을 엄격히 준수하여 설계되었습니다.

---

## 🚀 주요 기능 및 핵심 아키텍처

1. **Google Workspace Marketplace 배포 정책 엄격 준수**
   - **1시간 이상 주기 스케줄러 (`everyHours(1)`)**: 구글 워크스페이스 부가기능 환경에서 1시간 미만(분 단위) 트리거 생성 금지 정책을 준수하여 마켓플레이스 심사 반려 리스크를 원천 차단했습니다.
   - **Docs `onEdit` 부재 대응**: 실시간 편집 이벤트가 없는 Google Docs 특성을 반영하여, **[사이드바 수동 즉시 동기화 + 1시간 백그라운드 스케줄러]** 하이브리드 아키텍처를 적용했습니다.

2. **반응형 사이드바 UX (`CardService`) 및 다국어 지원**
   - **한국어 / English 실시간 언어 전환**: 사이드바 상단 버튼(`🌐 Switch to English` / `🌐 한국어로 전환`) 또는 우측 상단 점 3개(⋮) 메뉴를 통해 언제든지 UI 언어를 즉시 스위치할 수 있으며, 설정값은 사용자 계정(`UserProperties`)에 보존됩니다.
   - 상단에 **[⚡ 지금 즉시 동기화 (Sync Now)]** 버튼을 최우선 배치하여 편집 즉시 1클릭으로 동기화 가능.
   - 사이드바 클릭 핸들러는 `CardService.newActionResponseBuilder()`를 반환하여:
     - `setNotification()`을 통한 즉각적인 토스트 알림 팝업
     - `setNavigation(CardService.newNavigation().updateCard(...))`를 통한 동기화 현황(최근 동기화 시각, 파일명, 상태) 실시간 카드 리로드

3. **Drive API 부모 폴더 자동 탐색 및 권한 안정성**
   - 사용자가 기존에 작성해 둔 문서의 상위 디렉터리(`getParents()`)를 판별하고 동일 경로에 `.md` 파일을 안전하게 생성/갱신하기 위해 `https://www.googleapis.com/auth/drive` 권한을 선언했습니다. (런타임 `drive.file` 권한 거부 예외 원천 차단)
   - 동일 폴더에 `[문서명].md` 파일이 존재하면 `setContent()`로 내용 갱신, 없으면 `createFile()`로 신규 생성.

4. **동시 실행 충돌 방지 (`LockService`)**
   - 백그라운드 1시간 스케줄러와 사용자의 수동 즉시 동기화가 겹칠 경우 발생할 수 있는 파일 깨짐 및 동시 쓰기 충돌을 `LockService`로 10초 대기 락 제어.

5. **정밀 표준 마크다운 변환 엔진**
   - **제목**: Title, Subtitle, Heading 1~6 지원
   - **인라인 서식 및 공백 분리**: 볼드(`**text**`), 이탤릭(`*text*`), 취소선(`~~text~~`), 인라인 코드(`` `code` ``), 하이퍼링크 지원. 마크다운 기호 내부로 공백이 침범해 파서가 깨지는 현상(예: `** text **` 방지 $\rightarrow$ ` **text** `) 방지
   - **목록**: 글머리 기호(`- `) 및 번호 매기기(`1. `) 목록의 중첩 들여쓰기(`nestingLevel`)를 공백 2칸 단위로 보존
   - **표 (Table)**: GitHub Flavored Markdown (GFM) 형식 표 변환 (셀 내 개행은 `<br>` 치환, 파이프 `\|` 이스케이프)
   - **구분선**: 수평선(`---`)

---

## 📂 파일 구성

```text
auto_markdown/
├── Code.gs            # Add-on 전체 소스 코드 (CardService UI, 스케줄러, 변환 엔진, Drive I/O)
├── appsscript.json    # 매니페스트 (V8 런타임, OAuth 스코프, addOns.common/docs 선언)
├── PRIVACY.md         # 마켓플레이스 제출용 개인정보처리방침 (영문)
├── TERMS.md           # 마켓플레이스 제출용 서비스 이용약관 (영문)
└── README.md          # 영문 및 한국어 이중 언어 문서
```

---

## 🔐 OAuth 권한 스코프 명세 (`appsscript.json`)

| 스코프 | 용도 및 사유 |
| :--- | :--- |
| `https://www.googleapis.com/auth/documents.currentonly` | 현재 활성 구글 문서의 본문 읽기 (최소 권한) |
| `https://www.googleapis.com/auth/drive` | 기존 문서의 부모 폴더(`getParents()`) 탐색 및 동일 폴더 내 `.md` 파일 생성/갱신 |
| `https://www.googleapis.com/auth/script.scriptapp` | 1시간 주기 백그라운드 시간 기반 트리거 생성 및 관리 |
| `https://www.googleapis.com/auth/script.container.ui` | 사이드바 CardService 렌더링 및 UI 반응 |

---

## 🛠️ 설치 및 배포 방법

### 방법 1. 구글 문서에서 바로 테스트 (컨테이너 바인딩)

1. 동기화할 **Google Docs** 문서를 엽니다.
2. 상단 메뉴 **[확장 프로그램] > [Apps Script]**를 클릭합니다.
3. 좌측 톱니바퀴 아이콘(**프로젝트 설정**) $\rightarrow$ **`"appsscript.json" 매니페스트 파일 표시`**를 체크합니다.
4. [`appsscript.json`](./appsscript.json) 파일 내용을 열어 붙여넣고 저장(`Ctrl + S`)합니다.
5. [`Code.gs`](./Code.gs) 파일 내용을 열어 붙여넣고 저장(`Ctrl + S`)합니다.
6. 문서 창을 새로고침(F5)하면 우측 사이드바 패널 또는 상단 **[확장 프로그램] > [Markdown 동기화]** 메뉴가 활성화됩니다.

### 방법 2. clasp CLI 사용

```bash
# 로컬 코드를 Google Apps Script로 푸시
clasp push
```

---

## 📝 사용 가이드

1. **즉시 동기화**:
   - 문서를 편집한 후 사이드바 상단의 **[⚡ 지금 즉시 동기화 (Sync Now)]**를 클릭합니다.
   - 즉시 구글 드라이브의 동일 폴더에 `[문서명].md` 파일이 갱신/생성되며, 사이드바 카드에 완료 시각이 갱신됩니다.
2. **자동 스케줄러 켜기 (1시간 주기)**:
   - 사이드바에서 **[자동 동기화 켜기 (1시간 주기)]**를 클릭하면 스케줄러가 활성화되어 1시간마다 백그라운드에서 자동 갱신됩니다.
3. **자동 스케줄러 끄기**:
   - 사이드바에서 **[자동 동기화 끄기 (OFF)]**를 클릭하면 등록된 트리거가 안전하게 해제됩니다.
