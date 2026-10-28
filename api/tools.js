// Node 에서는 JSON 파일을 읽고, 브라우저(jeju.html)에서는 api/data.js 가 만든 전역값을 쓴다.
const isNode = typeof module !== "undefined" && module.exports;
const spots = isNode ? require("../jeju_spots.json").spots : JEJU_SPOTS;
const coords = isNode ? require("../jeju_coords.json") : JEJU_COORDS; // { 이름: [lat, lng] }

const AREAS = ["동쪽", "서쪽", "서귀포", "제주시"];
const MAX_RESULTS = 8;

// 'area' 는 큰 지역 이름. 데이터의 "동쪽(성산)" 같은 값은 "동쪽" 으로 묶어서 비교한다.
const find_spots = ({ area, indoor }) => {
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
];

const toolHandlers = { find_spots };

if (isNode) module.exports = { find_spots, toolDefinitions, toolHandlers };
