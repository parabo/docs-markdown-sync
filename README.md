# Google Docs Markdown Auto Sync Add-on

Google Docs(구글 문서)의 내용을 표준 마크다운(`.md`) 파일로 자동 변환하여, 해당 구글 문서가 위치한 Google Drive의 **동일한 폴더**에 자동으로 생성 및 5분 주기로 동기화하는 Google Apps Script 프로젝트입니다.

---

## 🚀 주요 기능

1. **상단 커스텀 메뉴 제공 (`onOpen`, `onInstall`)**
   - 구글 문서 상단 **[확장 프로그램]** 메뉴에 **[Markdown 동기화]** 메뉴 생성
   - **지금 즉시 동기화**: 클릭 즉시 현재 문서 내용을 마크다운으로 변환 및 저장
   - **자동 동기화 켜기 (5분 주기)**: Google Apps Script 시간 기반 트리거를 등록하여 5분마다 백그라운드 자동 동기화
   - **자동 동기화 끄기**: 등록된 트리거 삭제 및 자동 동기화 중지
2. **독립 실행 및 외부 서버 불필요**
   - 타사 서버나 API 없이 사용자 본인의 Google 계정 내(Apps Script / Drive API)에서만 안전하게 실행
3. **표준 마크다운 변환 엔진**
   - **헤딩 (Headings)**: Title/Heading 1 (`#`) ~ Heading 6 (`######`) 지원
   - **인라인 서식**: 볼드(`**text**`), 이탤릭(`*text*`), 볼드+이탤릭(`***text***`), 취소선(`~~text~~`)
   - **공백 보존 알고리즘**: 서식 태그 내부에 공백이 들어가 마크다운 렌더링이 깨지는 현상 방지
   - **코드 서식**: 모노스페이스 글꼴(Courier, Consolas 등)을 인라인 코드(`` `code` ``)로 자동 변환
   - **링크**: `[텍스트](URL)` 변환
   - **목록 (Lists)**: 글머리 기호 목록(`- `) 및 번호 목록(`1. `), 들여쓰기 계층(Nesting Level) 완벽 지원
   - **테이블 (Table)**: GitHub Flavored Markdown (GFM) 형식 표(`| Header | ... |`) 지원 (셀 내 줄바꿈은 `<br>` 처리)
   - **수평선**: `---` 지원
4. **동시 실행 충돌 방지 (`LockService`)**
   - 수동 실행과 5분 주기 트리거가 겹치더라도 파일이 깨지지 않도록 LockService 적용
5. **Google Drive 연동**
   - 현재 문서의 부모 폴더를 탐색하여 동일 폴더에 `[문서명].md` 파일이 존재하면 내용 갱신(`setContent`), 없으면 신규 생성(`createFile`)
6. **Google Workspace Add-on 사이드바 지원 (`addOns.docs`)**
   - 상단 메뉴뿐 아니라 사이드바 카드 인터페이스에서도 상태 확인 및 즉시 동기화/트리거 제어 가능

---

## 📂 프로젝트 구조

```text
auto_markdown/
├── Code.gs            # Add-on 전체 비즈니스 로직 및 마크다운 변환 엔진
├── appsscript.json    # Apps Script 매니페스트 (V8 런타임, OAuth 스코프, Add-on 설정)
└── README.md          # 프로젝트 설정 및 사용 가이드
```

---

## 🛠 설치 및 적용 방법

이 프로젝트는 두 가지 방법으로 적용할 수 있습니다.

### 방법 1. 특정 구글 문서에 직접 연결 (컨테이너 바인딩 - 가장 간편함)

1. 동기화하고 싶은 **Google Docs 문서**를 엽니다.
2. 상단 메뉴에서 **[확장 프로그램] > [Apps Script]**를 클릭합니다.
3. 왼쪽 탐색기에서 **`Code.gs`** 파일을 열고, 이 레포지토리의 [Code.gs](file:///d:/cloud/projects/auto_markdown/Code.gs) 내용을 복사하여 붙여넣습니다.
4. 왼쪽 톱니바퀴 아이콘(**프로젝트 설정**)을 누르고 **`"appsscript.json" 매니페스트 파일 표시`** 체크박스를 활성화합니다.
5. 왼쪽 파일 목록에 나타난 **`appsscript.json`** 파일을 열고, 이 레포지토리의 [appsscript.json](file:///d:/cloud/projects/auto_markdown/appsscript.json) 내용을 복사하여 붙여넣고 저장(`Ctrl + S`)합니다.
6. 구글 문서 창으로 돌아와 페이지를 **새로고침(F5)**합니다.
7. 상단 메뉴에 **[확장 프로그램] > [Markdown 동기화]** 메뉴가 표시됩니다!

---

### 방법 2. clasp (Command Line Apps Script Projects) 사용

로컬 터미널에서 Google Apps Script CLI인 `clasp`를 사용하여 배포할 수도 있습니다.

1. **clasp 설치 및 로그인**
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
2. **새 바운드 스크립트 생성 또는 기존 프로젝트 복제**
   - 구글 문서의 URL에서 문서 ID를 확인한 뒤:
   ```bash
   # 신규 생성 시
   clasp create --type docs --parentId "<YOUR_GOOGLE_DOC_ID>"
   
   # 또는 기존 Apps Script 프로젝트 ID로 복제 시
   clasp clone "<SCRIPT_ID>"
   ```
3. **코드 푸시**
   ```bash
   clasp push
   ```

---

## 🔑 초기 권한 승인 안내 (최초 1회)

구글 보안 정책상 스크립트를 처음 실행할 때 Google Drive 및 Docs 접근 권한 승인 팝업이 나타납니다.

1. 구글 문서 상단 **[확장 프로그램] > [Markdown 동기화] > [지금 즉시 동기화]** 클릭
2. **"승인 필요"** 안내 모달이 뜨면 **[계속]** 클릭
3. 본인의 Google 계정 선택
4. *"Google에서 확인하지 않은 앱입니다"* 화면이 나오면:
   - 왼쪽 하단 **[고급 (Advanced)]** 클릭
   - **`Markdown Auto Sync(으)로 이동(안전하지 않음)`** 클릭
5. 요청하는 권한(문서 보기/수정, Google Drive 파일 관리) 확인 후 **[허용]** 클릭

---

## 📝 사용 방법

1. **수동 동기화**:
   - 구글 문서에서 본문 작성 후 **[확장 프로그램] > [Markdown 동기화] > [지금 즉시 동기화]**를 누르면 즉시 동일 폴더에 `[문서명].md` 파일이 생성되거나 최신 내용으로 갱신됩니다.
2. **자동 동기화 켜기**:
   - **[확장 프로그램] > [Markdown 동기화] > [자동 동기화 켜기 (5분 주기)]**를 클릭합니다.
   - 백그라운드 5분 주기 시간 기반 트리거가 활성화되어 편집 중에도 자동으로 파일이 동기화됩니다.
3. **자동 동기화 끄기**:
   - **[확장 프로그램] > [Markdown 동기화] > [자동 동기화 끄기]**를 클릭하여 트리거를 해제합니다.
