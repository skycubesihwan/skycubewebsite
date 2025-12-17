// News Data
// 새로운 뉴스를 추가하려면 news 배열의 맨 위에 새 항목을 추가하세요.

const newsData = {
  "news": [
    {
      "id": 11,
      "date": "2025-11-25",
      "category": "event",
      "title": "✨ 대한민국 지역대포럼 참여 소감",
      "summary": "지방자치 30주년 기념 KNN '대한민국 지역대포럼'에 참석하여 지역 균형발전과 디지털 전환, 북극항로 시대의 새로운 기회에 대한 깊이 있는 논의를 들었습니다.",
      "image": "images/news-0012.jpg",
      "link": "news/news-0012.html"
    },
    {
      "id": 10,
      "date": "2025-11-12",
      "category": "event",
      "title": "🚀 Start-up NEST 18기 U-CONNECT DEMO DAY 참가 소식",
      "summary": "신용보증기금 주관 'Start-up NEST 18기 U-CONNECT DEMO DAY'에서 최종 발표 기업으로 참가하여 성과와 비전을 공유했습니다. 수개월간의 엑셀러레이팅 프로그램의 여정을 마무리했습니다.",
      "image": "images/news-0011.jpg",
      "link": "news/news-0011.html"
    },
    {
      "id": 9,
      "date": "2025-11-08",
      "category": "partnership",
      "title": "스카이큐브, 대한민국 행정수도 세종시와 업무협약 체결 🤝",
      "summary": "세종특별자치시와 '2025 세종 창업한마당' 행사에서 지역 혁신 창업 생태계 조성을 위한 업무협약(MOU)을 체결했습니다. 스마트시티와 혁신 창업 생태계 활성화에 기여합니다.",
      "image": "images/news-0010.jpg",
      "link": "news/news-0010.html"
    },
    {
      "id": 8,
      "date": "2025-10-15",
      "category": "achievement",
      "title": "🚀 스카이큐브, 제276차 부산경제포럼 '이달의 스타트업'으로 소개",
      "summary": "부산상공회의소 주최 제276차 부산경제포럼에서 '이달의 스타트업'으로 선정되어 소개되었습니다. 김시환 대표가 디지털 자산 플랫폼에 대한 비전과 전략을 발표했습니다.",
      "image": "images/news-0008-1.jpg",
      "link": "news/news-0008.html"
    },
    {
      "id": 7,
      "date": "2025-09-25",
      "category": "event",
      "title": "🚀 스카이큐브, 제275차 부산경제포럼 참여",
      "summary": "부산상공회의소가 주최한 제275차 부산경제포럼에 참석해 지역 혁신과 산업 발전을 위한 주요 담론에 함께했습니다. 행사 후 인터뷰를 통해 스카이큐브의 비전과 의견을 공유했습니다.",
      "image": "",
      "link": "news/news-0007.html"
    },
    {
      "id": 6,
      "date": "2025-09-22",
      "category": "event",
      "title": "스카이큐브, AX CONNECTING DAY 참석",
      "summary": "신용보증기금 Start-up NEST와 와이앤아처가 주최한 AX CONNECTING DAY에 참석하여 스타트업 창업가들의 특강을 듣고 사업을 소개하는 뜻깊은 시간을 가졌습니다.",
      "image": "images/news-0006.jpg",
      "link": "news/news-0006.html"
    },
    {
      "id": 5,
      "date": "2025-09-11",
      "category": "technology",
      "title": "도쿄대-하버드대 공동연구와 Q-Predictor™",
      "summary": "과거 데이터와 맥락을 활용하는 제어 방식이 엔트로피 감소에 더 효과적임을 입증한 연구가 발표되었습니다. 스카이큐브의 Q-Predictor™도 이러한 원리를 기반으로 개발 중입니다.",
      "image": "",
      "link": "news/news-0005.html"
    },
    {
      "id": 4,
      "date": "2025-08-12",
      "category": "achievement",
      "title": "🚀 스카이큐브, 코리아스타트업포럼 정식 회원사로 가입!",
      "summary": "국내 최대 스타트업 단체 코리아스타트업포럼의 정식 회원사로 합류했습니다. 2,500여 개의 혁신 기업과 함께하는 스타트업 생태계의 중심 허브에서 협력 기회를 제공받습니다.",
      "image": "",
      "link": "news/news-0004.html"
    },
    {
      "id": 3,
      "date": "2025-08-06",
      "category": "achievement",
      "title": "스카이큐브, 신용보증기금 Start-up NEST 제18기 선정!",
      "summary": "신용보증기금이 주관하는 창업기업 육성 플랫폼 Start-up NEST 제18기에 선정되어 기술성과 성장 가능성을 공식적으로 인정받았습니다.",
      "image": "images/news-0003.jpg",
      "link": "news/news-0003.html"
    },
    {
      "id": 2,
      "date": "2025-07-28",
      "category": "event",
      "title": "[2025 부산 슬러시드] 성공리에 마무리되었습니다!",
      "summary": "국내 최초의 크루즈 위 스타트업 축제, 2025 부산 슬러시드(BUSAN SLUSH'D)'에 SkyCube가 함께했습니다. 공중 공간의 디지털 자산화를 위한 비전을 공유하고 창의적인 스타트업들과 교류했습니다.",
      "image": "",
      "link": "news/news-0002.html"
    },
    {
      "id": 1,
      "date": "2025-07-21",
      "category": "press",
      "title": "🔷 SkyCube, now officially featured in the press!",
      "summary": "우리는 공중 공간의 권리를 디지털 자산으로 구조화하는 새로운 시장을 설계하고 있습니다. 이번 주, 동아일보에 스카이큐브의 비전과 사업 모델이 소개되었습니다.",
      "image": "",
      "link": "news/news-0001.html"
    }
  ]
};
