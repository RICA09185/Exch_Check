# 💱 환율 한눈에 - 모바일 웹 서비스 MVP

USD/KRW 등 주요 통화의 현재 기준 환율을 확인하고, 과거 평균(3개월~3년) 대비 비싼지 저렴한지 한눈에 판단할 수 있는 모바일 우선 웹 서비스입니다.

---

## 🚀 빠른 실행 방법 (로컬 실행)

별도의 웹 서버, Node.js 패키지 설치 또는 데이터베이스 설정이 필요하지 않습니다.

1. 파일 탐색기에서 `index.html` 파일이 위치한 폴더를 열어줍니다.
2. `index.html` 파일을 **마우스 더블 클릭**하여 크롬, 엣지 등 웹 브라우저로 바로 실행합니다.

---

## 🛠️ 기술 사양 및 데이터 연동

* **환율 API**: 공식 **Frankfurter API v2 (`https://api.frankfurter.dev/v2/rates`)** 전면 연동
  * 현재 환율: `https://api.frankfurter.dev/v2/rates?base=USD&quotes=KRW`
  * 기간별 시계열 환율: `https://api.frankfurter.dev/v2/rates?from=YYYY-MM-DD&to=YYYY-MM-DD&base=USD&quotes=KRW`
  * 구버전 API(`/v1/latest`, `symbols=`)는 사용하지 않습니다.
  * 현재 환율과 과거 평균 모두 동일한 API 표준으로 연산하며, 데이터가 없는 날짜, 주말, 공휴일 및 값 누락일은 엄격히 평균에서 제외됩니다.
* **HTML5 / CSS3 / Vanilla JS**: 외부 라이브러리(React, Vue, Chart.js 등) 없이 순수 웹 기술만으로 구현
* **HTML5 Canvas**: 순수 Canvas API 기반 1년 환율 추이 선 차트 및 평균선 시각화
* **Local Storage**: API 실패 시 캐시 복원 및 사용자 통화 선택 상태 저장 (임의의 데이터 생성 일절 금지)

---

## 💡 주요 기능

1. **통화 선택 & Swapping**: 기준 통화와 대상 통화(USD, KRW, JPY, EUR, CNY) 선택 및 전환 지원
2. **참고용 기준 환율 표시**: 1 기준 통화당 대상 통화 가격을 정확히 표시 (`1 USD = xxxx KRW` 형태 고정)
3. **직관적 환율 수준 판단**: 1년 평균 대비 환율 수준 판단 문구 및 신호등 컬러 배치 (저렴한 편 / 평균 수준 / 비싼 편)
4. **기간별 평균 비교**: 최근 3개월, 6개월, 1년, 2년, 3년 평균 환율과 % 차이 제공
5. **목표 환율 계산기**: 사용자가 설정한 목표 환율과의 금액 및 비율(%) 차이 실시간 계산
6. **Canvas 추이 차트**: 최근 1년간의 환율 변화 추이와 1년 평균 기준선을 그래프로 표시

---

## ⚠️ 필수 안내 및 주의사항

* 본 서비스의 환율은 참고용 기준 환율입니다.
* 실제 은행 및 환전소의 환율과 차이가 있을 수 있습니다.
* Exchange rate data provided by Frankfurter API v2.
