/**
 * @fileoverview Google Docs Markdown Auto Sync Add-on
 * Google Docs 문서를 표준 마크다운(.md) 파일로 변환하여 동일한 Google Drive 폴더에 동기화합니다.
 * 
 * [주요 특징]
 * - Google Workspace Marketplace 검수 정책 준수: 시간 기반 트리거 1시간 주기(everyHours(1)) 적용
 * - CardService 기반 고반응성 사이드바 UX: ActionResponseBuilder, setNotification, updateCard를 통한 실시간 피드백
 * - Drive API 및 최소 필요 권한(https://www.googleapis.com/auth/drive)을 통한 부모 폴더 자동 탐색 및 .md 파일 갱신/생성
 * - LockService 기반 동시 실행 충돌 방지
 * - 정밀 마크다운 변환 엔진: 헤딩, 서식 공백 분리, 중첩 목록, GFM 표 완벽 지원
 */

// ============================================================================
// 상수 및 환경설정
// ============================================================================

const CONFIG = {
  TRIGGER_FUNCTION: 'scheduledSync',
  TRIGGER_INTERVAL_HOURS: 1, // Workspace Add-on 정책에 따라 1시간 이상 주기 준수
  PROP_TARGET_DOC_ID: 'SYNC_TARGET_DOC_ID',
  PROP_AUTO_SYNC_ACTIVE: 'AUTO_SYNC_ACTIVE',
  PROP_LAST_SYNC_TIME: 'LAST_SYNC_TIME',
  PROP_LAST_SYNC_FILE: 'LAST_SYNC_FILE'
};

// ============================================================================
// Google Workspace Add-on 라이프사이클 및 사이드바 카드 렌더링
// ============================================================================

/**
 * Google Docs에서 부가기능 사이드바가 열릴 때 호출되는 홈 카드 렌더러
 * @param {Object} e 이벤트 객체
 * @return {CardService.Card} 사이드바 카드 객체
 */
function onDocsHomepage(e) {
  return buildMainCard_();
}

/**
 * 문서 상단 [확장 프로그램] 커스텀 메뉴 등록 (에디터 상단 메뉴 지원)
 * @param {Object} e 이벤트 객체
 */
function onOpen(e) {
  try {
    const ui = DocumentApp.getUi();
    const menu = ui.createAddonMenu ? ui.createAddonMenu() : ui.createMenu('Markdown 동기화');

    menu
      .addItem('지금 즉시 동기화', 'syncActiveDocFromMenu')
      .addSeparator()
      .addItem('자동 동기화 켜기 (1시간 주기)', 'setupTriggerFromMenu')
      .addItem('자동 동기화 끄기', 'stopTriggerFromMenu')
      .addToUi();
  } catch (error) {
    console.warn('[onOpen] 메뉴 등록 건너뜀 (사이드바 전용 모드이거나 UI 미지원 컨텍스트):', error);
  }
}

/**
 * Add-on 설치 시 호출
 * @param {Object} e 이벤트 객체
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * 사이드바 메인 카드를 동적으로 구성하는 팩토리 함수
 * @return {CardService.Card} 구성된 카드 객체
 * @private
 */
function buildMainCard_() {
  const isAutoSync = checkIsAutoSyncActive_();
  const docProps = PropertiesService.getDocumentProperties();
  const lastSyncTime = docProps.getProperty(CONFIG.PROP_LAST_SYNC_TIME) || '동기화 이력 없음';
  const lastSyncFile = docProps.getProperty(CONFIG.PROP_LAST_SYNC_FILE) || '(미생성)';

  let currentDocTitle = '현재 문서';
  try {
    const doc = DocumentApp.getActiveDocument();
    if (doc) {
      currentDocTitle = doc.getName();
    }
  } catch (err) {
    // 백그라운드 등 getActiveDocument 접근 불가 시 기본값 유지
  }

  const card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Markdown 자동 동기화')
      .setSubtitle('Google Docs to .md Sync')
      .setImageStyle(CardService.ImageStyle.SQUARE)
  );

  // --------------------------------------------------------------------------
  // 섹션 1: 최우선 빠른 실행 [지금 즉시 동기화]
  // --------------------------------------------------------------------------
  const sectionSyncNow = CardService.newCardSection()
    .setHeader('빠른 동기화');

  const syncNowAction = CardService.newAction().setFunctionName('handleManualSyncAction');
  const syncNowButton = CardService.newTextButton()
    .setText('⚡ 지금 즉시 동기화 (Sync Now)')
    .setOnClickAction(syncNowAction)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  sectionSyncNow.addWidget(syncNowButton);
  sectionSyncNow.addWidget(
    CardService.newTextParagraph()
      .setText('편집한 내용을 현재 문서와 <b>동일한 Drive 폴더</b>에 <code>[문서명].md</code> 파일로 즉시 갱신/생성합니다.')
  );

  // --------------------------------------------------------------------------
  // 섹션 2: 동기화 상태 및 정보
  // --------------------------------------------------------------------------
  const sectionStatus = CardService.newCardSection()
    .setHeader('동기화 현황');

  sectionStatus.addWidget(
    CardService.newKeyValue()
      .setTopLabel('대상 문서')
      .setContent(currentDocTitle)
  );

  sectionStatus.addWidget(
    CardService.newKeyValue()
      .setTopLabel('자동 스케줄러 (1시간 주기)')
      .setContent(isAutoSync ? '🟢 활성화됨 (ON)' : '⚪ 비활성화됨 (OFF)')
  );

  sectionStatus.addWidget(
    CardService.newKeyValue()
      .setTopLabel('최근 동기화 시각')
      .setContent(lastSyncTime)
  );

  sectionStatus.addWidget(
    CardService.newKeyValue()
      .setTopLabel('동기화된 파일명')
      .setContent(lastSyncFile)
  );

  // --------------------------------------------------------------------------
  // 섹션 3: 1시간 자동 스케줄러 설정 (Marketplace 정책 준수)
  // --------------------------------------------------------------------------
  const sectionScheduler = CardService.newCardSection()
    .setHeader('자동 동기화 설정 (1시간 스케줄러)');

  if (isAutoSync) {
    const disableAction = CardService.newAction().setFunctionName('handleDisableAutoSyncAction');
    const disableButton = CardService.newTextButton()
      .setText('자동 동기화 끄기 (OFF)')
      .setOnClickAction(disableAction);

    sectionScheduler.addWidget(disableButton);
    sectionScheduler.addWidget(
      CardService.newTextParagraph()
        .setText('현재 1시간마다 백그라운드에서 마크다운 파일이 자동 갱신됩니다.')
    );
  } else {
    const enableAction = CardService.newAction().setFunctionName('handleEnableAutoSyncAction');
    const enableButton = CardService.newTextButton()
      .setText('자동 동기화 켜기 (1시간 주기)')
      .setOnClickAction(enableAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

    sectionScheduler.addWidget(enableButton);
    sectionScheduler.addWidget(
      CardService.newTextParagraph()
        .setText('구글 부가기능 정책에 따라 백그라운드 자동 동기화는 <b>1시간 주기</b>로 실행됩니다.')
    );
  }

  // --------------------------------------------------------------------------
  // 섹션 4: 변환 지원 안내
  // --------------------------------------------------------------------------
  const sectionGuide = CardService.newCardSection()
    .setHeader('지원 마크다운 문법')
    .setCollapsible(true);

  sectionGuide.addWidget(
    CardService.newTextParagraph().setText(
      '• <b>제목</b>: Title, Subtitle, Heading 1~6<br>' +
      '• <b>인라인 서식</b>: 볼드, 이탤릭, 취소선, 인라인 코드, 링크<br>' +
      '• <b>목록</b>: 글머리 기호 및 번호 목록 (들여쓰기 계층 지원)<br>' +
      '• <b>표</b>: GFM 테이블 (셀 내 줄바꿈 & 파이프 이스케이프)<br>' +
      '• <b>구분선</b>: 수평선(---) 지원'
    )
  );

  card.addSection(sectionSyncNow);
  card.addSection(sectionStatus);
  card.addSection(sectionScheduler);
  card.addSection(sectionGuide);

  return card.build();
}

// ============================================================================
// CardService 버튼 클릭 액션 핸들러 (ActionResponseBuilder 필수 사용)
// ============================================================================

/**
 * 사이드바 [지금 즉시 동기화] 버튼 클릭 핸들러
 * @param {Object} e 이벤트 객체
 * @return {CardService.ActionResponse}
 */
function handleManualSyncAction(e) {
  let doc = null;
  try {
    doc = DocumentApp.getActiveDocument();
  } catch (err) {
    console.error('[handleManualSyncAction] getActiveDocument 실패:', err);
  }

  if (!doc) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('❌ 활성화된 구글 문서를 찾을 수 없습니다.'))
      .build();
  }

  const result = executeSync_(doc, true);
  let notificationText = '';

  if (result.success) {
    notificationText = `✅ 동기화 완료: '${result.fileName}' (${result.syncTime})`;
  } else {
    notificationText = `❌ 동기화 실패: ${result.message}`;
  }

  // 최신 동기화 시각 및 파일명이 갱신된 메인 카드로 즉시 리로드
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(notificationText))
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

/**
 * 사이드바 [자동 동기화 켜기 (1시간 주기)] 버튼 클릭 핸들러
 * @param {Object} e 이벤트 객체
 * @return {CardService.ActionResponse}
 */
function handleEnableAutoSyncAction(e) {
  let doc = null;
  try {
    doc = DocumentApp.getActiveDocument();
  } catch (err) {
    console.error('[handleEnableAutoSyncAction] getActiveDocument 실패:', err);
  }

  if (!doc) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('❌ 문서를 찾을 수 없어 스케줄러를 등록하지 못했습니다.'))
      .build();
  }

  setupSchedulerInternal_(doc);

  // 설정 즉시 1회 동기화 수행
  executeSync_(doc, false);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('🟢 자동 동기화(1시간 주기)가 활성화되었습니다.'))
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

/**
 * 사이드바 [자동 동기화 끄기] 버튼 클릭 핸들러
 * @param {Object} e 이벤트 객체
 * @return {CardService.ActionResponse}
 */
function handleDisableAutoSyncAction(e) {
  stopSchedulerInternal_();

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('⚪ 자동 동기화 스케줄러가 해제되었습니다.'))
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

// ============================================================================
// 상단 메뉴용 핸들러 (DocumentApp UI 상호작용 지원)
// ============================================================================

function syncActiveDocFromMenu() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return;
  const result = executeSync_(doc, true);
  try {
    if (result.success) {
      doc.getUi().toast(`'${result.fileName}' 동기화 완료!`, 'Markdown 동기화', 4);
    } else {
      doc.getUi().alert('동기화 실패', result.message, doc.getUi().ButtonSet.OK);
    }
  } catch (e) {
    console.log('[syncActiveDocFromMenu]', result);
  }
}

function setupTriggerFromMenu() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return;
  setupSchedulerInternal_(doc);
  executeSync_(doc, false);
  try {
    doc.getUi().toast('자동 동기화가 활성화되었습니다. (1시간 주기)', 'Markdown 동기화', 4);
  } catch (e) {}
}

function stopTriggerFromMenu() {
  stopSchedulerInternal_();
  try {
    const doc = DocumentApp.getActiveDocument();
    if (doc) {
      doc.getUi().toast('자동 동기화가 해제되었습니다.', 'Markdown 동기화', 4);
    }
  } catch (e) {}
}

// ============================================================================
// 스케줄러 및 트리거 내부 로직 (1시간 주기 준수)
// ============================================================================

/**
 * 1시간 주기 시간 기반 트리거를 생성하고 설정 상태를 저장합니다.
 * @param {GoogleAppsScript.Document.Document} doc
 * @private
 */
function setupSchedulerInternal_(doc) {
  const docId = doc.getId();
  const docProps = PropertiesService.getDocumentProperties();
  const userProps = PropertiesService.getUserProperties();

  // 대상 문서 ID 및 상태 보존 (백그라운드 트리거 호출 시 사용)
  docProps.setProperty(CONFIG.PROP_TARGET_DOC_ID, docId);
  docProps.setProperty(CONFIG.PROP_AUTO_SYNC_ACTIVE, 'true');
  userProps.setProperty(CONFIG.PROP_TARGET_DOC_ID + '_' + docId, docId);

  // 기존 스케줄러 중복 방지 정리
  deleteAllTriggersInternal_();

  // 구글 워크스페이스 마켓플레이스 부가기능 정책: 1시간 이상 주기(everyHours(1))
  ScriptApp.newTrigger(CONFIG.TRIGGER_FUNCTION)
    .timeBased()
    .everyHours(CONFIG.TRIGGER_INTERVAL_HOURS)
    .create();

  console.log(`[AutoSync] 문서 '${doc.getName()}'(ID: ${docId})에 대해 1시간 주기 트리거 생성 완료`);
}

/**
 * 등록된 스케줄러 트리거를 모두 제거하고 상태를 끕니다.
 * @private
 */
function stopSchedulerInternal_() {
  deleteAllTriggersInternal_();
  const docProps = PropertiesService.getDocumentProperties();
  docProps.setProperty(CONFIG.PROP_AUTO_SYNC_ACTIVE, 'false');
  console.log('[AutoSync] 1시간 주기 스케줄러 트리거 해제 완료');
}

/**
 * 프로젝트 내 관련 트리거 일괄 삭제
 * @return {number} 삭제된 트리거 수
 * @private
 */
function deleteAllTriggersInternal_() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (let i = 0; i < triggers.length; i++) {
    const handler = triggers[i].getHandlerFunction();
    if (handler === CONFIG.TRIGGER_FUNCTION || handler === 'syncActiveDocToMarkdown') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  return count;
}

/**
 * 자동 동기화 트리거가 실제 활성 상태인지 확인
 * @return {boolean}
 * @private
 */
function checkIsAutoSyncActive_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === CONFIG.TRIGGER_FUNCTION) {
      return true;
    }
  }
  return false;
}

/**
 * 1시간 시간 기반 트리거가 구글 서버에서 백그라운드로 실행할 함수
 */
function scheduledSync() {
  console.log('[AutoSync] 1시간 주기 백그라운드 동기화 트리거 시작');

  let doc = null;
  try {
    doc = DocumentApp.getActiveDocument();
  } catch (e) {
    console.log('[AutoSync] 백그라운드 컨텍스트: getActiveDocument() 미지원');
  }

  // 백그라운드 환경에서는 getActiveDocument()가 null일 수 있으므로 저장된 ID로 오픈
  if (!doc) {
    const docProps = PropertiesService.getDocumentProperties();
    const docId = docProps.getProperty(CONFIG.PROP_TARGET_DOC_ID);
    if (docId) {
      try {
        doc = DocumentApp.openById(docId);
      } catch (err) {
        console.error('[AutoSync] openById 실패:', err);
      }
    }
  }

  if (!doc) {
    console.warn('[AutoSync] 동기화 대상 문서를 특정할 수 없어 실행을 중단합니다.');
    return;
  }

  const result = executeSync_(doc, false);
  console.log('[AutoSync] 백그라운드 동기화 완료:', JSON.stringify(result));
}

// ============================================================================
// Drive 입출력 및 동기화 핵심 함수 (LockService 동시성 제어)
// ============================================================================

/**
 * 구글 문서 내용을 마크다운으로 변환하여 동일 부모 폴더에 동기화합니다.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {boolean} isManual
 * @return {Object} { success: boolean, fileName: string, syncTime: string, message?: string }
 * @private
 */
function executeSync_(doc, isManual) {
  // LockService 적용 (최대 10초 대기)
  const lock = LockService.getDocumentLock() || LockService.getUserLock();
  if (!lock || !lock.tryLock(10000)) {
    console.warn('[AutoSync] 동시 실행 방지: 다른 동기화 작업이 진행 중입니다.');
    return {
      success: false,
      message: '다른 동기화 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.'
    };
  }

  try {
    const docId = doc.getId();
    const docName = doc.getName();
    const mdFileName = `${docName}.md`;

    // 1. Google Docs 본문을 마크다운으로 변환
    const markdownContent = convertDocToMarkdown_(doc);

    // 2. DriveApp을 통해 현재 문서의 부모 폴더 탐색 (https://www.googleapis.com/auth/drive 스코프 필수)
    const file = DriveApp.getFileById(docId);
    const parents = file.getParents();
    const parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

    // 3. 동일 폴더 내 [문서명].md 파일 존재 여부 확인 후 내용 갱신(setContent) 또는 신규 생성(createFile)
    const existingFiles = parentFolder.getFilesByName(mdFileName);
    let mdFile;

    if (existingFiles.hasNext()) {
      mdFile = existingFiles.next();
      mdFile.setContent(markdownContent);
      console.log(`[AutoSync] 기존 마크다운 파일 갱신 완료: ${mdFileName} (ID: ${mdFile.getId()})`);
    } else {
      mdFile = parentFolder.createFile(mdFileName, markdownContent, MimeType.PLAIN_TEXT);
      console.log(`[AutoSync] 신규 마크다운 파일 생성 완료: ${mdFileName} (ID: ${mdFile.getId()})`);
    }

    // 4. 마지막 동기화 메타데이터 기록 (사이드바 카드 리로드 시 사용)
    const nowStr = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    const docProps = PropertiesService.getDocumentProperties();
    docProps.setProperty(CONFIG.PROP_LAST_SYNC_TIME, nowStr);
    docProps.setProperty(CONFIG.PROP_LAST_SYNC_FILE, mdFileName);
    docProps.setProperty(CONFIG.PROP_TARGET_DOC_ID, docId);

    return {
      success: true,
      fileName: mdFileName,
      fileId: mdFile.getId(),
      folderName: parentFolder.getName(),
      syncTime: nowStr
    };
  } catch (error) {
    console.error('[AutoSync] 동기화 중 오류 발생:', error);
    return {
      success: false,
      message: error.toString()
    };
  } finally {
    // 락 해제
    if (lock) {
      lock.releaseLock();
    }
  }
}

// ============================================================================
// 정밀 마크다운 변환 엔진 (Google Docs Body -> Markdown)
// ============================================================================

/**
 * Google Docs Body 객체를 순회하여 표준 마크다운(GFM) 텍스트로 변환합니다.
 * @param {GoogleAppsScript.Document.Document} doc 변환할 문서
 * @return {string} 변환된 표준 마크다운 문자열
 * @private
 */
function convertDocToMarkdown_(doc) {
  const body = doc.getBody();
  const numChildren = body.getNumChildren();
  const output = [];

  let inList = false;

  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    // 목록이 종료된 시점에 구분 빈 줄 삽입
    if (type !== DocumentApp.ElementType.LIST_ITEM && inList) {
      inList = false;
      output.push('');
    }

    switch (type) {
      case DocumentApp.ElementType.PARAGRAPH: {
        const paragraph = child.asParagraph();
        const mdPara = convertParagraphToMarkdown_(paragraph);
        if (mdPara !== null) {
          output.push(mdPara);
        }
        break;
      }

      case DocumentApp.ElementType.LIST_ITEM: {
        inList = true;
        const listItem = child.asListItem();
        const mdListItem = convertListItemToMarkdown_(listItem);
        output.push(mdListItem);
        break;
      }

      case DocumentApp.ElementType.TABLE: {
        const table = child.asTable();
        const mdTable = convertTableToMarkdown_(table);
        if (mdTable) {
          output.push(mdTable);
        }
        break;
      }

      case DocumentApp.ElementType.HORIZONTAL_RULE: {
        output.push('---');
        break;
      }

      default:
        break;
    }
  }

  // 문단 결합 및 과도한 연속 빈 줄 정리 (최대 2개 개행 보존)
  return output.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * Paragraph 요소를 마크다운으로 변환합니다 (헤딩 및 인라인 서식 처리).
 * @param {GoogleAppsScript.Document.Paragraph} paragraph
 * @return {string|null}
 * @private
 */
function convertParagraphToMarkdown_(paragraph) {
  const textContent = convertContainerTextToMarkdown_(paragraph);

  if (!textContent.trim()) {
    return '';
  }

  const heading = paragraph.getHeading();
  let prefix = '';

  switch (heading) {
    case DocumentApp.ParagraphHeading.TITLE:
    case DocumentApp.ParagraphHeading.HEADING_1:
      prefix = '# ';
      break;
    case DocumentApp.ParagraphHeading.SUBTITLE:
    case DocumentApp.ParagraphHeading.HEADING_2:
      prefix = '## ';
      break;
    case DocumentApp.ParagraphHeading.HEADING_3:
      prefix = '### ';
      break;
    case DocumentApp.ParagraphHeading.HEADING_4:
      prefix = '#### ';
      break;
    case DocumentApp.ParagraphHeading.HEADING_5:
      prefix = '##### ';
      break;
    case DocumentApp.ParagraphHeading.HEADING_6:
      prefix = '###### ';
      break;
    default:
      prefix = '';
      break;
  }

  return prefix + textContent.trim();
}

/**
 * ListItem 요소를 마크다운 목록 문법으로 변환합니다.
 * 들여쓰기 계층(nestingLevel)을 공백 2칸 단위로 보존합니다.
 * @param {GoogleAppsScript.Document.ListItem} listItem
 * @return {string}
 * @private
 */
function convertListItemToMarkdown_(listItem) {
  const nestingLevel = listItem.getNestingLevel();
  const indent = '  '.repeat(nestingLevel); // 2칸 단위 들여쓰기 준수

  const glyphType = listItem.getGlyphType();
  let marker = '- ';

  // 번호 매기기 목록 판별
  if (
    glyphType === DocumentApp.GlyphType.NUMBER ||
    glyphType === DocumentApp.GlyphType.LATIN_LOWER ||
    glyphType === DocumentApp.GlyphType.LATIN_UPPER ||
    glyphType === DocumentApp.GlyphType.ROMAN_LOWER ||
    glyphType === DocumentApp.GlyphType.ROMAN_UPPER
  ) {
    marker = '1. ';
  } else {
    marker = '- ';
  }

  const textContent = convertContainerTextToMarkdown_(listItem).trim();
  return `${indent}${marker}${textContent}`;
}

/**
 * Table 요소를 GitHub Flavored Markdown (GFM) 표 규격으로 변환합니다.
 * 셀 내부 개행은 <br>로 치환하고, 파이프(|) 문자를 이스케이프(\|)합니다.
 * @param {GoogleAppsScript.Document.Table} table
 * @return {string}
 * @private
 */
function convertTableToMarkdown_(table) {
  const numRows = table.getNumRows();
  if (numRows === 0) return '';

  const mdLines = [];
  let colCount = 0;

  for (let r = 0; r < numRows; r++) {
    const row = table.getRow(r);
    const numCells = row.getNumCells();
    if (numCells > colCount) colCount = numCells;

    const cellTexts = [];
    for (let c = 0; c < numCells; c++) {
      const cell = row.getCell(c);
      let cellMd = convertContainerTextToMarkdown_(cell).trim();
      // 셀 내부 줄바꿈은 <br> 처리, 파이프 문자 이스케이프
      cellMd = cellMd.replace(/\n+/g, '<br>').replace(/\|/g, '\\|');
      cellTexts.push(cellMd);
    }
    mdLines.push(`| ${cellTexts.join(' | ')} |`);

    // 첫 번째 행 이후 GFM 헤더 구분선 삽입
    if (r === 0) {
      const separators = [];
      for (let i = 0; i < numCells; i++) {
        separators.push('---');
      }
      mdLines.push(`| ${separators.join(' | ')} |`);
    }
  }

  return mdLines.join('\n');
}

/**
 * Paragraph, ListItem, TableCell 등 자식 요소를 가진 컨테이너의 텍스트를 인라인 서식을 보존하여 변환합니다.
 * @param {GoogleAppsScript.Document.Element} container
 * @return {string}
 * @private
 */
function convertContainerTextToMarkdown_(container) {
  const numChildren = container.getNumChildren();
  let result = '';

  for (let i = 0; i < numChildren; i++) {
    const child = container.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.TEXT) {
      result += convertTextElementToMarkdown_(child.asText());
    } else if (type === DocumentApp.ElementType.INLINE_IMAGE) {
      const img = child.asInlineImage();
      const alt = img.getAltDescription() || img.getAltTitle() || '이미지';
      result += `![${alt}]()`;
    } else if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
      result += '\n---\n';
    } else if (child.getNumChildren && child.getNumChildren() > 0) {
      result += convertContainerTextToMarkdown_(child);
    }
  }

  return result;
}

/**
 * Text 요소의 속성(Attribute) 구간을 분석하여 볼드, 이탤릭, 취소선, 인라인 코드, 하이퍼링크를 변환합니다.
 * 서식 기호 내부로 공백이 침범하여 마크다운 렌더링이 깨지는 현상을 방지하기 위해 공백 분리 로직을 적용합니다.
 * 
 * @param {GoogleAppsScript.Document.Text} textElement
 * @return {string}
 * @private
 */
function convertTextElementToMarkdown_(textElement) {
  const text = textElement.getText();
  if (!text) return '';

  const indices = textElement.getTextAttributeIndices();
  let formattedText = '';

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = (i < indices.length - 1) ? indices[i + 1] : text.length;
    const chunk = text.substring(start, end);

    if (!chunk) continue;

    // 해당 구간의 스타일 속성 판별
    const isBold = !!textElement.isBold(start);
    const isItalic = !!textElement.isItalic(start);
    const isStrike = !!textElement.isStrikethrough(start);
    const linkUrl = textElement.getLinkUrl(start);
    const fontFamily = textElement.getFontFamily(start);
    const isCode = isMonospaceFont_(fontFamily);

    // 순수 개행 문자만 있는 경우 스타일 적용 생략
    if (/^\n+$/.test(chunk)) {
      formattedText += chunk;
      continue;
    }

    // [핵심] 공백 분리 로직: 서식 기호 바깥으로 공백을 보존 (예: " hello " -> " ", "hello", " ")
    const leadingMatch = chunk.match(/^\s+/);
    const trailingMatch = chunk.match(/\s+$/);
    const leadingSpace = leadingMatch ? leadingMatch[0] : '';
    const trailingSpace = trailingMatch ? trailingMatch[0] : '';
    const core = chunk.trim();

    // 순수 공백 구간인 경우
    if (!core) {
      formattedText += chunk;
      continue;
    }

    let styled = core;

    // 1. 인라인 코드 서식
    if (isCode) {
      styled = `\`${styled}\``;
    } else {
      // 2. 취소선 / 볼드 / 이탤릭 서식
      if (isStrike) {
        styled = `~~${styled}~~`;
      }
      if (isBold && isItalic) {
        styled = `***${styled}***`;
      } else if (isBold) {
        styled = `**${styled}**`;
      } else if (isItalic) {
        styled = `*${styled}*`;
      }
    }

    // 3. 하이퍼링크 서식
    if (linkUrl) {
      styled = `[${styled}](${linkUrl})`;
    }

    formattedText += leadingSpace + styled + trailingSpace;
  }

  return formattedText;
}

/**
 * 폰트 패밀리명이 모노스페이스(코드 폰트)인지 판별합니다.
 * @param {string} fontFamily
 * @return {boolean}
 * @private
 */
function isMonospaceFont_(fontFamily) {
  if (!fontFamily) return false;
  const lower = fontFamily.toLowerCase();
  return (
    lower.includes('courier') ||
    lower.includes('consolas') ||
    lower.includes('mono') ||
    lower.includes('source code') ||
    lower.includes('menlo')
  );
}
