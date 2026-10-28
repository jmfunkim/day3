const { spots } = require("../jeju_spots.json");
const coords = require("../jeju_coords.json"); // { 이름: [lat, lng] }

const AREAS = ["동쪽", "서쪽", "서귀포", "제주시"];
const MAX_RESULTS = 8;

// 날씨 조회용 지역 대표 좌표 (동쪽=성산, 서쪽=한림)
const AREA_CENTER = {
  동쪽: [33.46, 126.93],
  서쪽: [33.41, 126.27],
  서귀포: [33.25, 126.56],
  제주시: [33.5, 126.53],
};

// Open-Meteo 의 WMO 날씨 코드 → 한글
const WEATHER_CODE = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
  45: "안개", 48: "안개",
  51: "약한 이슬비", 53: "이슬비", 55: "강한 이슬비",
  61: "약한 비", 63: "비", 65: "강한 비",
  71: "약한 눈", 73: "눈", 75: "강한 눈",
  80: "약한 소나기", 81: "소나기", 82: "강한 소나기",
  95: "천둥번개", 96: "천둥번개와 우박", 99: "천둥번개와 우박",
};

// 'area' 는 큰 지역 이름. 데이터의 "동쪽(성산)" 같은 값은 "동쪽" 으로 묶어서 비교한다.
const find_spots = async ({ area, indoor }) => {
  if (!AREAS.includes(area)) {
    return { error: `area 는 ${AREAS.join(" · ")} 중 하나여야 합니다.` };
  }
  // 지도에 찍어야 하므로 좌표가 있는 장소만 대상으로 한다.
  const found = spots.filter(
    (s) =>
      coords[s.name] &&
      (s.area === area || s.area.startsWith(area + "(")) &&
      (indoor === undefined || s.indoor === indoor)
  );
  return {
    total: found.length,
    spots: found.slice(0, MAX_RESULTS).map((s) => ({
      name: s.name,
      area: s.area,
      indoor: s.indoor,
      description: s.type,
      lat: coords[s.name][0],
      lng: coords[s.name][1],
    })),
  };
};

// Open-Meteo (API 키 불필요) 에서 지역별 일별 예보를 가져온다.
const get_weather = async ({ area, days = 3 }) => {
  if (!AREAS.includes(area)) {
    return { error: `area 는 ${AREAS.join(" · ")} 중 하나여야 합니다.` };
  }
  const n = Math.min(Math.max(Math.round(Number(days)) || 3, 1), 7);
  const [lat, lng] = AREA_CENTER[area];
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lng}&timezone=Asia%2FSeoul&forecast_days=${n}` +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max";
  const res = await fetch(url);
  if (!res.ok) return { error: `날씨 조회 실패 (HTTP ${res.status})` };
  const { daily } = await res.json();
  return {
    area,
    forecast: daily.time.map((date, i) => ({
      date,
      weather: WEATHER_CODE[daily.weather_code[i]] || `코드 ${daily.weather_code[i]}`,
      temp_max_c: daily.temperature_2m_max[i],
      temp_min_c: daily.temperature_2m_min[i],
      rain_probability_percent: daily.precipitation_probability_max[i],
      rain_mm: daily.precipitation_sum[i],
      wind_max_kmh: daily.wind_speed_10m_max[i],
    })),
  };
};

const toolDefinitions = [
  {
    name: "find_spots",
    description:
      "제주 관광지 목록(jeju_spots.json)에서 지역과 실내 여부로 장소를 찾아 최대 8곳의 이름 · 지역 · 실내 여부 · 설명 · 좌표(lat, lng)를 돌려준다. 결과는 지도에 표시된다. " +
      "목록 밖 장소는 없다: 결과에 없는 장소는 추천하거나 지어내지 말고, 결과가 비면 목록에 없다고 답한다. " +
      "운영시간 · 요금 등은 목록에 없으므로 알 수 없다고 안내한다.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          enum: AREAS,
          description: "찾을 지역 (동쪽 · 서쪽 · 서귀포 · 제주시 중 하나)",
        },
        indoor: {
          type: "boolean",
          description: "true 면 실내, false 면 야외만. 생략하면 둘 다.",
        },
      },
      required: ["area"],
    },
  },
  {
    name: "get_weather",
    description:
      "제주 지역(동쪽 · 서쪽 · 서귀포 · 제주시)의 일별 날씨 예보를 Open-Meteo 에서 가져온다. " +
      "날씨 · 최고/최저기온 · 강수확률 · 강수량 · 최대풍속을 오늘부터 최대 7일까지 돌려준다. " +
      "비가 오거나 바람이 센 날은 실내, 맑은 날은 야외 장소를 고르는 근거로 쓴다.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          enum: AREAS,
          description: "날씨를 볼 지역 (동쪽 · 서쪽 · 서귀포 · 제주시 중 하나)",
        },
        days: {
          type: "integer",
          minimum: 1,
          maximum: 7,
          description: "오늘부터 며칠치 예보를 볼지 (기본 3)",
        },
      },
      required: ["area"],
    },
  },
];

const toolHandlers = { find_spots, get_weather };

module.exports = { find_spots, get_weather, toolDefinitions, toolHandlers };
