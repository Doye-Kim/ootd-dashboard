# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 프로젝트 컨텍스트

### 앱이 하는 일

코디 탐색 보조 대시보드. AI가 룩을 추천하는 게 아니라, 사용자가 오늘 뭐 입을지 결정할 때 참고할 시각 자료를 한 화면에 모아주는 앱. 실제 결정은 사용자가 한다.

### 핵심 설계 결정

**Vision은 업로드 시 1회만 실행한다**
사진 업로드 시점에 한 번 실행하고 결과를 JSON에 저장한다. 대시보드 렌더링이나 필터링 시에는 Claude API를 호출하지 않는다. API 비용과 응답속도 때문에.

**필터링은 단순 JSON 태그 매칭으로만 한다**
벡터 임베딩, ML 모델 쓰지 않는다. 태그 배열 교집합으로 충분하다. over-engineering하지 않는다.

**Claude API 호출은 `lib/claude.ts`를 통해서만 한다**
API Route에서 SDK를 직접 import하지 않는다. 키 관리와 에러 핸들링을 한 곳에서 처리하기 위해서.

**환경변수는 서버에서만 쓴다**
`ANTHROPIC_API_KEY`, `OPENWEATHER_API_KEY`는 클라이언트에 절대 노출하지 않는다. API Route와 Server Action에서만 사용.
