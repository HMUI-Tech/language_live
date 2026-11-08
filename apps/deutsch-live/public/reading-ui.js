window.DLReadingUI = {
  create({
    h,
    today,
    getProgress,
    onComplete,
    onActivity,
    speak,
    signedIn,
    onResult = () => {},
  }) {
    const stories = window.DLReadingStories,
      core = window.DLReadingCore,
      root = h("section", { class: "reading-zone stack" });
    let level = "A1",
      current = null,
      choices = {},
      checked = new Set(),
      saved = false,
      feedback = "";
    const button = (text, action, extra = {}) =>
      h(
        "button",
        { type: "button", class: "btn", onclick: action, ...extra },
        text,
      );
    function open(story) {
      speak(null);
      current = story;
      choices = {};
      checked = new Set();
      saved = false;
      feedback = "";
      onActivity();
      paint();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function paint() {
      const progress = core.sanitize(getProgress(), stories);
      if (!current) {
        const list = stories.filter((s) => s.level === level),
          done = list.filter((s) => progress[s.id]).length;
        root.replaceChildren(
          h(
            "header",
            { class: "stack" },
            h("p", { class: "eyebrow" }, "LESEN · READING COMPREHENSION"),
            h("h1", {}, "Geschichten verstehen"),
            h(
              "p",
              {},
              "40 original stories · 10 per level from A1 to B2 · 7–15 sentences each. Read, explore the vocabulary, then check your understanding.",
            ),
            h(
              "p",
              { class: "small muted" },
              "Levels are learning guidance. These activities are not an official CEFR assessment.",
            ),
          ),
          h(
            "div",
            { class: "row", role: "group", "aria-label": "Reading level" },
            ...["A1", "A2", "B1", "B2"].map((l) =>
              button(
                l,
                () => {
                  level = l;
                  paint();
                },
                {
                  "aria-pressed": String(level === l),
                  class: level === l ? "btn primary" : "btn",
                },
              ),
            ),
          ),
          h("p", {}, `${level} · ${done} / 10 stories completed`),
          h(
            "div",
            { class: "reading-library" },
            list.map((s, i) =>
              h(
                "article",
                { class: "panel stack" },
                h("p", { class: "eyebrow" }, `${s.level} · ${s.theme}`),
                h("h2", {}, `${i + 1}. ${s.title}`),
                h(
                  "p",
                  { class: "small muted" },
                  `${s.sentences.length} sentences · ${s.questions.length} questions`,
                ),
                h(
                  "p",
                  { class: "small" },
                  progress[s.id]
                    ? `Best score: ${progress[s.id].best} / ${s.questions.length} · Last completed: ${progress[s.id].date}`
                    : "Ready to read",
                ),
                button(
                  progress[s.id] ? "Read again" : "Read story",
                  () => open(s),
                  { class: "btn primary" },
                ),
              ),
            ),
          ),
          h(
            "p",
            { class: "small muted" },
            signedIn
              ? "Completion dates and best scores are saved with your account progress."
              : "Guest reading progress lasts while this page stays open. Sign in to save across visits.",
          ),
        );
        return;
      }
      const s = current,
        score = [...checked].filter(
          (i) => choices[i] === s.questions[i].answer,
        ).length;
      const story = h(
        "article",
        { class: "panel reading-story", lang: "de" },
        h("h2", {}, s.title),
        ...s.sentences.map((text) => h("p", {}, text)),
      );
      const questions = s.questions.map((q, i) =>
        h(
          "fieldset",
          { class: "panel reading-question" },
          h("legend", {}, `${i + 1}. ${q.prompt}`),
          ...q.options.map((option, j) =>
            h(
              "label",
              { class: "reading-option" },
              h("input", {
                type: "radio",
                name: `reading-${s.id}-${i}`,
                value: String(j),
                checked: choices[i] === j,
                disabled: checked.has(i),
                onchange: () => {
                  choices[i] = j;
                  feedback = "";
                },
              }),
              h("span", { lang: "de" }, option),
            ),
          ),
          checked.has(i)
            ? h(
                "div",
                { class: "reading-answer", role: "status" },
                h(
                  "b",
                  {},
                  choices[i] === q.answer
                    ? "Richtig! ✓"
                    : "Noch nicht richtig.",
                ),
                h(
                  "p",
                  { lang: "de" },
                  "Richtige Antwort: " + q.options[q.answer],
                ),
                h("p", { lang: "de" }, q.explanation),
              )
            : button("Check answer", () => {
                if (choices[i] === undefined) {
                  feedback = `Choose an answer for question ${i + 1} first.`;
                  paint();
                  return;
                }
                checked.add(i);
                feedback = "";
                if (checked.size === s.questions.length && !saved) {
                  saved = true;
                  const total = s.questions.filter(
                    (q, n) => choices[n] === q.answer,
                  ).length;
                  onComplete(
                    core.complete(getProgress(), s, total, today(), stories),
                  );
                  onResult({
                    op: "event",
                    kind: "reading",
                    id: s.id,
                    answers: s.questions.map((_, i) => choices[i]),
                  });
                }
                paint();
              }),
        ),
      );
      root.replaceChildren(
        h(
          "div",
          { class: "row" },
          button("← All stories", () => {
            speak(null);
            current = null;
            feedback = "";
            paint();
          }),
          h(
            "span",
            { class: "eyebrow" },
            `${s.level} · ${s.theme} · ${s.sentences.length} sentences`,
          ),
        ),
        h("h1", {}, s.title),
        h(
          "p",
          { class: "muted" },
          "Read the story first. You can keep it open while answering. After checking, each answer includes an explanation in German.",
        ),
        h(
          "div",
          { class: "row" },
          button("Listen to the story", () => speak(s.sentences.join(" "))),
          button("Stop audio", () => speak(null)),
        ),
        story,
        h(
          "details",
          { class: "panel" },
          h("summary", {}, "Vocabulary help · Wortschatz"),
          h(
            "dl",
            { class: "reading-words" },
            ...s.words.flatMap((w) => [
              h("dt", { lang: "de" }, w.de),
              h("dd", {}, w.en),
            ]),
          ),
        ),
        h(
          "details",
          { class: "panel" },
          h("summary", {}, "English summary · show after reading"),
          h("p", {}, s.summary),
        ),
        h("h2", {}, "Fragen zum Text"),
        h(
          "p",
          { class: "small" },
          "Answer all three questions to record a completion. You can retry any story; your best score stays.",
        ),
        h("p", { role: "status", "aria-live": "polite" }, feedback),
        ...questions,
        checked.size === s.questions.length
          ? h(
              "div",
              { class: "note stack" },
              h("h2", {}, `Story complete · ${score} / ${s.questions.length}`),
              h(
                "p",
                {},
                score === s.questions.length
                  ? "Well done! You understood the key details."
                  : "Read the explanations, then try again when you are ready.",
              ),
              h(
                "p",
                { class: "small" },
                signedIn
                  ? "Your result has been added to your account progress. Check the sync indicator for save status."
                  : "Your result is kept in this page only. Sign in to save future practice.",
              ),
              h(
                "div",
                { class: "row" },
                button("Try again", () => open(s)),
                button("Choose another story", () => {
                  speak(null);
                  current = null;
                  paint();
                }),
              ),
            )
          : "",
      );
    }
    paint();
    return root;
  },
};
