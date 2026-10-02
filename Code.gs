/**
 * @fileoverview Google Docs Markdown Auto Sync Add-on
 * Google Docs 문서를 표준 마크다운(.md) 파일로 변환하여 동일한 Google Drive 폴더에 동기화합니다.
 */

// ============================================================================
// 상수 및 환경설정
// ============================================================================

const CONFIG = {
  TRIGGER_FUNCTION: 'scheduledSync',
  TRIGGER_INTERVAL_MINUTES: 5,
  PROP_TARGET_DOC_ID: 'SYNC_TARGET_DOC_ID',
  PROP_AUTO_SYNC_ACTIVE: 'AUTO_SYNC_ACTIVE',
  PROP_LAST_SYNC_TIME: 'LAST_SYNC_TIME'
};

// ============================================================================
// 메뉴 및 Add-on 라이프사이클 이벤트
// ============================================================================

/**
 * 문서가 열릴 때 호출되어 상단 [확장 프로그램] 메뉴에 커스텀 메뉴를 추가합니다.
 * @param {Object} e 이벤트 객체
 */
function onOpen(e) {
  try {
    const ui = DocumentApp.getUi();
    const menu = ui.createAddonMenu ? ui.createAddonMenu() : ui.createMenu('Markdown 동기화');

    menu
      .addItem('지금 즉시 동기화', 'syncActiveDocToMarkdown')
      .addSeparator()
      .addItem('자동 동기화 켜기 (5분 주기)', 'setupTrigger')
      .addItem('자동 동기화 끄기', 'stopTrigger')
      .addToUi();
  } catch (error) {
    console.error('onOpen 실행 중 오류:', error);
  }
}

/**
 * Add-on이 설치될 때 호출됩니다.
 * @param {Object} e 이벤트 객체
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Google Workspace Add-on 사이드바 홈 화면(Card) 렌더러
 * @param {Object} e 이벤트 객체
 * @return {CardService.Card} 사이드바 카드 객체
 */
function onDocsHomepage(e) {
  const isAutoSync = checkIsAutoSyncActive_();
  const lastSync = PropertiesService.getDocumentProperties().getProperty(CONFIG.PROP_LAST_SYNC_TIME) || '동기화 이력 없음';

  const card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Markdown 자동 동기화')
      .setSubtitle('Google Docs to .md Sync')
      .setImageStyle(CardService.ImageStyle.SQUARE)
  );

  const sectionStatus = CardService.newCardSection().setHeader('동기화 상태');
  sectionStatus.addWidget(
    CardService.newKeyValue()
      .setTopLabel('자동 동기화 (5분 주기)')
      .setContent(isAutoSync ? '활성화됨 (ON)' : '비활성화됨 (OFF)')
  );
  sectionStatus.addWidget(
    CardService.newKeyValue()
      .setTopLabel('최근 동기화 시각')
      .setContent(lastSync)
  );

  const sectionActions = CardService.newCardSection().setHeader('실행 및 설정');

  const syncNowAction = CardService.newAction().setFunctionName('syncActiveDocToMarkdown');
  const syncNowButton = CardService.newTextButton()
    .setText('지금 즉시 동기화')
    .setOnClickAction(syncNowAction)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  const setupAction = CardService.newAction().setFunctionName('setupTrigger');
  const setupButton = CardService.newTextButton()
    .setText('자동 동기화 켜기')
    .setOnClickAction(setupAction);

  const stopAction = CardService.newAction().setFunctionName('stopTrigger');
  const stopButton = CardService.newTextButton()
    .setText('자동 동기화 끄기')
    .setOnClickAction(stopAction);

  sectionActions.addWidget(syncNowButton);
  sectionActions.addWidget(setupButton);
  sectionActions.addWidget(stopButton);

  card.addSection(sectionStatus);
  card.addSection(sectionActions);

  return card.build();
}

// ============================================================================
// 트리거 관리 (setupTrigger, stopTrigger)
// ============================================================================

/**
 * 5분 단위 시간 기반 트리거를 생성하고 자동 동기화를 시작합니다.
 */
function setupTrigger() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    showUiAlert_('오류', '활성화된 문서를 찾을 수 없습니다.');
    return;
  }

  const docId = doc.getId();

  // 백그라운드 트리거 실행을 위해 문서 ID 및 활성 상태 저장
  const docProps = PropertiesService.getDocumentProperties();
  const userProps = PropertiesService.getUserProperties();
  docProps.setProperty(CONFIG.PROP_TARGET_DOC_ID, docId);
  docProps.setProperty(CONFIG.PROP_AUTO_SYNC_ACTIVE, 'true');
  userProps.setProperty(CONFIG.PROP_TARGET_DOC_ID + '_' + docId, docId);

  // 기존 중복 트리거 삭제
  deleteExistingTriggers_();

  // 5분 단위 시간 기반 트리거 생성
  ScriptApp.newTrigger(CONFIG.TRIGGER_FUNCTION)
    .timeBased()
    .everyMinutes(CONFIG.TRIGGER_INTERVAL_MINUTES)
    .create();

  console.log(`[AutoSync] 문서 '${doc.getName()}'(ID: ${docId})에 대해 5분 주기 트리거가 설정되었습니다.`);

  // 첫 동기화 즉시 1회 수행
  executeSync_(doc, false);

  showUiToast_('자동 동기화가 활성화되었습니다. 5분마다 마크다운 파일이 자동 갱신됩니다.', 'Markdown 동기화');
}

/**
 * 등록된 자동 동기화 시간 기반 트리거를 삭제하고 자동 동기화를 중지합니다.
 */
function stopTrigger() {
  const deletedCount = deleteExistingTriggers_();

  const docProps = PropertiesService.getDocumentProperties();
  docProps.setProperty(CONFIG.PROP_AUTO_SYNC_ACTIVE, 'false');

  console.log(`[AutoSync] 자동 동기화 트리거 ${deletedCount}개가 삭제되었습니다.`);
  showUiToast_('자동 동기화가 비활성화되었습니다.', 'Markdown 동기화');
}

/**
 * 현재 프로젝트에 등록된 자동 동기화 트리거를 모두 제거합니다.
 * @return {number} 삭제된 트리거 개수
 * @private
 */
function deleteExistingTriggers_() {
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
 * 자동 동기화가 현재 활성화되어 있는지 여부를 확인합니다.
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

// ============================================================================
// 동기화 실행 (수동 및 트리거 호출)
// ============================================================================

/**
 * 메뉴에서 [지금 즉시 동기화]를 클릭했을 때 실행되는 함수
 */
function syncActiveDocToMarkdown() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    showUiAlert_('오류', '현재 활성화된 구글 문서를 가져올 수 없습니다.');
    return;
  }

  showUiToast_('마크다운 파일로 동기화하는 중...', 'Markdown 동기화');
  const result = executeSync_(doc, true);

  if (result.success) {
    showUiToast_(`'${result.fileName}' 동기화 완료!`, 'Markdown 동기화');
  } else {
    showUiAlert_('동기화 실패', result.message || '알 수 없는 오류가 발생했습니다.');
  }
}

/**
 * 시간 기반 트리거에 의해 5분마다 백그라운드에서 호출되는 핸들러 함수
 */
function scheduledSync() {
  console.log('[AutoSync] 5분 주기 시간 기반 동기화 시작');

  let doc = null;
  try {
    doc = DocumentApp.getActiveDocument();
  } catch (e) {
    console.log('[AutoSync] getActiveDocument() 미지원 환경, 저장된 docId 조회 시도:', e);
  }

  // 시간 기반 트리거의 경우 getActiveDocument()가 null일 수 있으므로 저장된 Document ID로 열기
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
    console.warn('[AutoSync] 동기화 대상 문서를 찾을 수 없어 이번 주기를 건너뜁니다.');
    return;
  }

  const result = executeSync_(doc, false);
  console.log('[AutoSync] 동기화 결과:', JSON.stringify(result));
}

/**
 * 문서를 마크다운으로 변환하여 부모 폴더에 저장/갱신하는 핵심 실행 함수
 * LockService를 통해 동시 실행 충돌을 방지합니다.
 * 
 * @param {GoogleAppsScript.Document.Document} doc 동기화할 문서 객체
 * @param {boolean} isManual 수동 실행 여부
 * @return {Object} 실행 결과 { success: boolean, fileName: string, message: string }
 * @private
 */
function executeSync_(doc, isManual) {
  // LockService 적용 (최대 10초 대기)
  const lock = LockService.getDocumentLock() || LockService.getUserLock();
  if (!lock || !lock.tryLock(10000)) {
    console.warn('[AutoSync] 이미 다른 동기화 작업이 진행 중입니다.');
    return {
      success: false,
      message: '다른 동기화 작업이 이미 진행 중입니다. 잠시 후 다시 시도해 주세요.'
    };
  }

  try {
    const docId = doc.getId();
    const docName = doc.getName();
    const mdFileName = `${docName}.md`;

    // 1. Google Docs 문서 내용을 마크다운으로 변환
    const markdownContent = convertDocToMarkdown_(doc);

    // 2. DriveApp을 사용하여 문서의 부모 폴더 획득
    const file = DriveApp.getFileById(docId);
    const parents = file.getParents();
    const parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

    // 3. 동일 폴더 내 [문서명].md 파일 존재 여부 확인 및 갱신/생성
    const existingFiles = parentFolder.getFilesByName(mdFileName);
    let mdFile;

    if (existingFiles.hasNext()) {
      mdFile = existingFiles.next();
      mdFile.setContent(markdownContent);
      console.log(`[AutoSync] 기존 마크다운 파일 갱신 완료: ${mdFileName} (ID: ${mdFile.getId()})`);
    } else {
      mdFile = parentFolder.createFile(mdFileName, markdownContent, MimeType.PLAIN_TEXT);
      console.log(`[AutoSync] 새 마크다운 파일 생성 완료: ${mdFileName} (ID: ${mdFile.getId()})`);
    }

    // 4. 마지막 동기화 시간 기록
    const nowStr = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    PropertiesService.getDocumentProperties().setProperty(CONFIG.PROP_LAST_SYNC_TIME, nowStr);

    return {
      success: true,
      fileName: mdFileName,
      fileId: mdFile.getId(),
      folderName: parentFolder.getName(),
      syncTime: nowStr
    };
  } catch (error) {
    console.error('[AutoSync] 동기화 중 에러 발생:', error);
    return {
      success: false,
      message: error.toString()
    };
  } finally {
    // 락 해제 보장
    lock.releaseLock();
  }
}

// ============================================================================
// Google Docs -> 마크다운(Markdown) 변환 엔진
// ============================================================================

/**
 * Google Docs Body 객체를 순회하여 표준 마크다운 텍스트로 변환합니다.
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

    // 리스트 아이템이 끝났을 때 빈 줄 추가
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
        // 지원하지 않는 기타 요소(TableOfContents 등)는 필요 시 텍스트만 추출
        break;
    }
  }

  // 최종 마크다운 문자열 결합 및 연속된 과도한 빈 줄 정리 (최대 2개 개행)
  return output.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * Paragraph 요소를 마크다운으로 변환합니다 (헤딩 및 인라인 서식 처리).
 * @param {GoogleAppsScript.Document.Paragraph} paragraph
 * @return {string|null} 변환된 마크다운 문단 문자열
 * @private
 */
function convertParagraphToMarkdown_(paragraph) {
  const textContent = convertContainerTextToMarkdown_(paragraph);

  // 빈 문단인 경우
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
 * @param {GoogleAppsScript.Document.ListItem} listItem
 * @return {string} 변환된 마크다운 목록 행
 * @private
 */
function convertListItemToMarkdown_(listItem) {
  const nestingLevel = listItem.getNestingLevel();
  const indent = '  '.repeat(nestingLevel); // 레벨당 2칸 공백

  const glyphType = listItem.getGlyphType();
  let marker = '- ';

  // 번호 목록 여부 판별
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
 * Table 요소를 GitHub Flavored Markdown (GFM) 표로 변환합니다.
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
      // 셀 내부 텍스트 변환, 줄바꿈은 <br>로 치환, 파이프(|) 이스케이프
      let cellMd = convertContainerTextToMarkdown_(cell).trim();
      cellMd = cellMd.replace(/\n+/g, '<br>').replace(/\|/g, '\\|');
      cellTexts.push(cellMd);
    }
    mdLines.push(`| ${cellTexts.join(' | ')} |`);

    // 첫 번째 행을 헤더로 간주하고 구분선 삽입
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
 * Text 요소의 속성(Attribute) 구간을 분석하여 볼드, 이탤릭, 링크, 코드, 취소선을 마크다운으로 변환합니다.
 * 공백이 서식 마커 안으로 들어가 마크다운 파서가 깨지는 현상을 방지합니다.
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

    // 해당 구간의 스타일 속성 확인
    const isBold = !!textElement.isBold(start);
    const isItalic = !!textElement.isItalic(start);
    const isStrike = !!textElement.isStrikethrough(start);
    const linkUrl = textElement.getLinkUrl(start);
    const fontFamily = textElement.getFontFamily(start);
    const isCode = isMonospaceFont_(fontFamily);

    // 개행 문자만 있는 경우 스타일 적용 생략
    if (/^\n+$/.test(chunk)) {
      formattedText += chunk;
      continue;
    }

    // 앞뒤 공백 분리 (예: " hello " -> " ", "hello", " ")
    const leadingMatch = chunk.match(/^\s+/);
    const trailingMatch = chunk.match(/\s+$/);
    const leadingSpace = leadingMatch ? leadingMatch[0] : '';
    const trailingSpace = trailingMatch ? trailingMatch[0] : '';
    const core = chunk.trim();

    // 순수 공백 구간
    if (!core) {
      formattedText += chunk;
      continue;
    }

    let styled = core;

    // 1. 인라인 코드 서식
    if (isCode) {
      styled = `\`${styled}\``;
    } else {
      // 2. 볼드 / 이탤릭 / 취소선 서식
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

// ============================================================================
// UI 피드백 유틸리티 (Alert, Toast)
// ============================================================================

/**
 * 구글 문서 UI에 간단한 Toast 메시지를 띄웁니다 (문서 UI 접근 가능할 때만).
 * @param {string} message 표시할 메시지
 * @param {string} title 토스트 제목
 * @private
 */
function showUiToast_(message, title) {
  try {
    const doc = DocumentApp.getActiveDocument();
    if (doc) {
      doc.getUi().toast(message, title || 'Markdown 동기화', 4);
    }
  } catch (e) {
    // 백그라운드 트리거 등 UI가 없는 환경에서는 무시
  }
}

/**
 * 구글 문서 UI에 알림 모달(Alert)을 표시합니다.
 * @param {string} title 알림 제목
 * @param {string} message 알림 본문
 * @private
 */
function showUiAlert_(title, message) {
  try {
    const ui = DocumentApp.getUi();
    if (ui) {
      ui.alert(title, message, ui.ButtonSet.OK);
    }
  } catch (e) {
    console.log(`[Alert - ${title}] ${message}`);
  }
}
