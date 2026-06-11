function baseInstruction() {
  return [
    'Ты методист LMS.',
    'Верни только JSON без markdown.',
    'Используй русский язык.',
    'Обязательно добавляй explanation и points для вопросов.',
    'Допустимые type: single, multiple, matching.'
  ].join(' ');
}

export function buildPrompt(generationType, input) {
  const instruction = baseInstruction();
  if (generationType === 'course') {
    return `${instruction}
Сгенерируй курс по предметной области "${input.subjectArea || 'общая тематика'}".
Верни JSON: {"title":"", "description":"", "fullDescription":"", "category":"", "level":"beginner|intermediate|advanced", "duration":8, "learningList":[""], "lessons":[{"title":"","order":1,"duration":15,"content":"","questions":[...]}]}
Лимит уроков: ${input.lessonCount || 3}.`;
  }
  if (generationType === 'lesson') {
    return `${instruction}
Сгенерируй один урок для courseId=${input.courseId}.
Верни JSON: {"title":"","order":1,"duration":15,"content":"","questions":[{"type":"single","question":"","options":[""],"correctIndex":0,"explanation":"","points":1}]}.
Лимит вопросов: ${input.questionsCount || 5}.`;
  }
  if (generationType === 'test') {
    return `${instruction}
Сгенерируй тест для lessonId=${input.lessonId}.
Верни JSON: {"questions":[{"type":"single|multiple|matching","question":"","options":[""],"correctIndex":0,"correctIndices":[0,2],"matchingPairs":[{"left":"","right":""}],"explanation":"","points":1}]}.
Лимит вопросов: ${input.questionsCount || 5}.`;
  }
  if (generationType === 'matching') {
    return `${instruction}
Сгенерируй matching-задание для lessonId=${input.lessonId || ''}.
Промпт: ${input.matchingPrompt || input.questionPrompt || ''}.
Верни JSON: {"type":"matching","question":"","matchingPairs":[{"left":"","right":""}],"explanation":"","points":1}.`;
  }
  return `${instruction}
Сгенерируй один вопрос для lessonId=${input.lessonId || ''}.
Промпт: ${input.questionPrompt || ''}.
Верни JSON: {"type":"single|multiple","question":"","options":[""],"correctIndex":0,"correctIndices":[0],"explanation":"","points":1}.`;
}
