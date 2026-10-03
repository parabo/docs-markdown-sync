# Google Docs Markdown Auto Sync (Google Workspace Add-on)

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
└── README.md          # 프로젝트 설정 및 사용 가이드
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
4. [`appsscript.json`](file:///d:/cloud/projects/auto_markdown/appsscript.json) 파일 내용을 열어 붙여넣고 저장(`Ctrl + S`)합니다.
5. [`Code.gs`](file:///d:/cloud/projects/auto_markdown/Code.gs) 파일 내용을 열어 붙여넣고 저장(`Ctrl + S`)합니다.
6. 문서 창을 새로고침(F5)하면 우측 사이드바 패널 또는 상단 **[확장 프로그램] > [Markdown 동기화]** 메뉴가 활성화됩니다.

### 방법 2. Google Workspace Add-on 배포 테스트

1. Apps Script 편집기 우측 상단 **[배포] > [배포 테스트]**를 클릭합니다.
2. 유형으로 **[Google Workspace 부가기능]**을 선택하고 설치합니다.
3. Google Docs 문서를 열면 우측 사이드바 아이콘에 **Markdown Auto Sync**가 나타납니다.

---

## 📝 사용 가이드

1. **즉시 동기화**:
   - 문서를 편집한 후 사이드바 상단의 **[⚡ 지금 즉시 동기화 (Sync Now)]**를 클릭합니다.
   - 즉시 구글 드라이브의 동일 폴더에 `[문서명].md` 파일이 갱신/생성되며, 사이드바 카드에 완료 시각이 갱신됩니다.
2. **자동 스케줄러 켜기 (1시간 주기)**:
   - 사이드바에서 **[자동 동기화 켜기 (1시간 주기)]**를 클릭하면 스케줄러가 활성화되어 1시간마다 백그라운드에서 자동 갱신됩니다.
3. **자동 스케줄러 끄기**:
   - 사이드바에서 **[자동 동기화 끄기 (OFF)]**를 클릭하면 등록된 트리거가 안전하게 해제됩니다.
