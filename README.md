# SKYCUBE Website

SKYCUBE의 공식 웹사이트입니다. 도심 항공 모빌리티(UAM) 시대를 선도하는 디지털 자산 플랫폼을 소개합니다.

## 프로젝트 구조

```
test_website/
├── index.html          # 홈페이지
├── mission.html        # 미션 소개 페이지
├── news.html          # 뉴스 목록 페이지
├── contact.html       # 연락처 페이지
├── styles.css         # 전역 스타일시트
├── config.js          # 사이트 설정 (테마, 네비게이션 등)
├── news.js            # 뉴스 데이터
├── main.js            # 메인 JavaScript 로직
├── images/            # 이미지 파일
│   ├── SkyCube_logo.png
│   └── news-*.jpg
└── news/              # 뉴스 상세 페이지
    ├── news-0001.html
    ├── news-0002.html
    └── ...
```

## 주요 기능

### 1. 반응형 디자인
- 모바일, 태블릿, 데스크톱 환경에 최적화
- 모바일 메뉴 토글 지원

### 2. 동적 콘텐츠 관리
- `config.js`: 사이트 전역 설정 (테마, 네비게이션)
- `news.js`: 뉴스 데이터 관리
- JavaScript를 통한 동적 렌더링

### 3. 뉴스 관리 시스템
- 뉴스 목록은 `news.js`에서 중앙 관리
- 각 뉴스는 `/news/` 폴더에 개별 HTML 파일로 저장
- 날짜 역순으로 자동 정렬

## 뉴스 추가 방법

### 1단계: 뉴스 데이터 추가
`news.js` 파일의 `news` 배열 **맨 위**에 새 항목을 추가하세요:

```javascript
{
  "id": 12,                              // 고유 ID (1씩 증가)
  "date": "2025-12-10",                  // 날짜 (YYYY-MM-DD)
  "category": "event",                   // 카테고리
  "title": "뉴스 제목",                   // 제목
  "summary": "뉴스 요약 내용...",         // 요약 (2줄까지 표시)
  "image": "images/news-0013.jpg",       // 이미지 경로 (선택사항)
  "link": "news/news-0013.html"          // 상세 페이지 링크
}
```

### 2단계: 상세 페이지 생성
`/news/` 폴더에 `news-XXXX.html` 파일을 생성하고 기존 파일을 템플릿으로 사용하세요.

**수정 필요한 부분:**
- `<title>` 태그
- `.news-detail-title` (제목)
- `.news-detail-date` (날짜)
- `.news-detail-image img src` (이미지 경로)
- `.news-detail-body` (본문 내용)

### 3단계: 이미지 추가 (선택사항)
이미지가 있는 경우 `/images/` 폴더에 `news-XXXX.jpg` 형식으로 저장하세요.

## 파일 관리 규칙

### 네이밍 규칙
- 뉴스 파일: `news-XXXX.html` (예: news-0001.html)
- 뉴스 이미지: `news-XXXX.jpg` 또는 `news-XXXX-N.jpg` (예: news-0008-1.jpg, news-0008-2.jpg)

### 경로 규칙
- 루트 페이지에서: `images/`, `styles.css`, `index.html`
- `/news/` 하위 페이지에서: `../images/`, `../styles.css`, `../index.html`

## 설정 파일

### config.js
사이트 전역 설정을 관리합니다:
- 사이트 정보 (제목, 설명, 이메일)
- 테마 색상
- 네비게이션 메뉴
- 히어로 섹션 설정
- 푸터 설정

### news.js
뉴스 데이터를 관리합니다:
- 각 뉴스의 메타데이터 (id, date, category, title, summary, image, link)
- 새로운 뉴스는 배열 맨 위에 추가

## 브라우저 지원

- Chrome (최신 버전)
- Firefox (최신 버전)
- Safari (최신 버전)
- Edge (최신 버전)

## 로컬 실행 방법

1. 프로젝트 폴더를 로컬에 다운로드
2. `index.html` 파일을 브라우저로 열기
3. 또는 로컬 서버 실행:
   ```bash
   # Python 3
   python -m http.server 8000

   # 브라우저에서 http://localhost:8000 접속
   ```

## 기술 스택

- HTML5
- CSS3 (Flexbox, Grid)
- Vanilla JavaScript (ES6+)
- Google Fonts (Montserrat, Open Sans)

## 유지보수

### 코드 수정 시 주의사항
1. `main.js`의 경로 감지 로직을 수정하지 마세요
2. 날짜 형식은 반드시 `YYYY-MM-DD` 형식을 유지하세요
3. 이미지를 추가할 때는 웹 최적화를 권장합니다 (JPEG 품질 80-90%)

### 일반적인 문제 해결
- **네비게이션 링크가 작동하지 않음**: 파일 경로를 확인하세요 (`../` 포함 여부)
- **날짜가 하루 빠르게 표시됨**: `news.js`의 날짜 형식 확인 (`YYYY-MM-DD`)
- **이미지가 표시되지 않음**: 이미지 경로와 파일명 확인

## 연락처

- **Email**: info@skycube.ai
- **Office**: 부산광역시 남구 전포대로 133, 11층

---

© 2025 SKYCUBE. All rights reserved.
