const { toolDefinitions, toolHandlers } = require("./tools");

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
const MAX_STEPS = 6; // 도구 호출 왕복 최대 횟수
const MAX_INPUT = 300;

const SYSTEM = `너는 제주 여행 추천 도우미 agent 다.
- 추천하기 전에 반드시 도구를 쓴다: 날씨는 get_weather, 장소는 find_spots.
- 지역이 정해지지 않았으면 사용자 말에서 가장 가까운 지역을 고른다. 날짜를 모르면 오늘부터 3일치를 본다.
- 비가 오거나(강수확률 높음) 바람이 센 날은 실내, 맑은 날은 야외 장소를 우선 찾는다.
- 목록 밖 장소는 없다. find_spots 결과에 있는 장소만 추천하고, 운영시간 · 요금은 모른다고 말한다.
- 답은 한국어 일반 텍스트로 짧게 쓴다(마크다운 기호 금지). 날씨 근거를 한 줄 쓰고, 장소 3~5곳을 이름과 이유로 추천한다.`;

const callClaude = async (messages) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools: toolDefinitions, messages }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

// agent 루프: Claude 가 도구를 부르면 실행해서 결과를 돌려주고, 더 부르지 않을 때까지 반복한다.
const runAgent = async (question) => {
  const messages = [{ role: "user", content: question }];
  const trace = []; // 화면에 보여줄 도구 호출 기록
  const found = new Map(); // find_spots 가 돌려준 장소들 (지도용)

  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = await callClaude(messages);
    messages.push({ role: "assistant", content: reply.content });

    const calls = reply.content.filter((b) => b.type === "tool_use");
    if (reply.stop_reason !== "tool_use" || !calls.length) {
      const answer = reply.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      return { answer, trace, spots: [...found.values()] };
    }

    const results = [];
    for (const call of calls) {
      let result;
      try {
        result = await toolHandlers[call.name](call.input);
      } catch (e) {
        result = { error: String(e.message || e) };
      }
      trace.push({ name: call.name, input: call.input });
      if (call.name === "find_spots" && result.spots) result.spots.forEach((s) => found.set(s.name, s));
      results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: results });
  }
  return { answer: "도구를 너무 많이 호출해서 중단했습니다. 질문을 더 구체적으로 해 주세요.", trace, spots: [...found.values()] };
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST 만 가능합니다." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "서버에 ANTHROPIC_API_KEY 환경변수가 없습니다." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const question = String(body.question || "").trim().slice(0, MAX_INPUT);
  if (!question) return res.status(400).json({ error: "question 이 비어 있습니다." });

  try {
    res.status(200).json(await runAgent(question));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};

module.exports.runAgent = runAgent;
