const FIELD_LABELS = {
  Name: 'ФИО',
  Email: 'Email',
  Password: 'Пароль',
  'Department name': 'Название отдела',
  'Position name': 'Название должности',
  Title: 'Название курса',
  Description: 'Описание',
  Category: 'Категория',
  Level: 'Уровень',
  Duration: 'Длительность',
  'Lesson title': 'Название урока',
  'Lesson content': 'Текст урока',
  'Lesson order': 'Порядок урока',
  'Lesson duration': 'Длительность урока'
};

export function fieldLabel(name) {
  return FIELD_LABELS[name] || name;
}

export function msg(code, params = {}) {
  switch (code) {
    case 'FIELD_REQUIRED':
      return `Поле «${fieldLabel(params.fieldName || params.field)}» обязательно для заполнения`;
    case 'EMAIL_REQUIRED':
      return 'Укажите email';
    case 'EMAIL_INVALID':
      return 'Некорректный email';
    case 'EMAIL_DOMAIN_FORBIDDEN':
      return `Регистрация доступна только для адресов @${params.domain}`;
    case 'PASSWORD_TOO_SHORT':
      return 'Пароль должен содержать не менее 8 символов';
    case 'EMAIL_EXISTS':
      return 'Пользователь с таким email уже существует';
    case 'NOT_FOUND':
      return 'Запись не найдена';
    case 'USER_NOT_FOUND':
      return 'Пользователь не найден';
    case 'INVALID_STATE':
      return params.message || 'Недопустимое состояние';
    case 'ADMIN_ALREADY_ACTIVE':
      return 'Администратор уже активен';
    case 'DEPARTMENT_NOT_FOUND':
      return 'Отдел не найден';
    case 'POSITION_NOT_FOUND':
      return 'Должность не найдена';
    case 'POSITION_DEPARTMENT_MISMATCH':
      return 'Выбранная должность не относится к указанному отделу';
    case 'INVALID_PASSWORD':
      return 'Текущий пароль указан неверно';
    case 'INVALID_CREDENTIALS':
      return 'Неверный email или пароль';
    case 'AUTHENTICATION_REQUIRED':
      return 'Требуется авторизация';
    case 'ACCOUNT_PENDING':
      return 'Учётная запись ожидает подтверждения администратором';
    case 'INVALID_TOKEN':
      return 'Недействительный или просроченный токен';
    case 'FORBIDDEN':
      return 'Доступ запрещён';
    case 'REFRESH_TOKEN_MISSING':
      return 'Токен обновления отсутствует';
    case 'REFRESH_TOKEN_INVALID':
      return 'Недействительный токен обновления';
    case 'REGISTRATION_SUBMITTED':
      return 'Заявка на регистрацию отправлена. Ожидайте подтверждения администратором.';
    case 'SELF_ENROLLMENT_DISABLED':
      return 'Самостоятельная запись на курс отключена. Обратитесь к администратору.';
    case 'CANNOT_DELETE_SELF':
      return 'Нельзя удалить свою учётную запись';
    case 'DEPARTMENT_EXISTS':
      return 'Отдел с таким названием уже существует';
    case 'POSITION_EXISTS':
      return 'Должность с таким названием уже есть в этом отделе';
    case 'COURSE_NOT_FOUND':
      return 'Курс не найден';
    case 'LESSON_NOT_FOUND':
      return 'Урок не найден';
    case 'INVALID_NUMBER':
      return `Поле «${fieldLabel(params.fieldName)}» должно быть корректным числом`;
    case 'COURSE_NOT_ASSIGNED':
      return 'Курс не назначен пользователю';
    case 'ASSIGNMENT_NOT_FOUND':
      return 'Назначение не найдено';
    case 'UNABLE_TO_ASSIGN':
      return 'Не удалось назначить курс';
    case 'TEST_FAILED':
      return `Результат теста ${params.score}% ниже проходного порога (${params.passThreshold}%)`;
    case 'CERTIFICATE_NOT_READY':
      return 'Сертификат доступен только для завершённых курсов';
    case 'CERTIFICATE_FONT_MISSING':
      return 'Не найдены шрифты для генерации PDF. Обратитесь к администратору.';
    case 'ANSWER_OPTIONS_REQUIRED':
      return 'Нужно не менее двух вариантов ответа';
    case 'INVALID_ANSWER_INDEX':
      return 'Некорректный индекс правильного ответа';
    case 'INTERNAL_ERROR':
      return 'Внутренняя ошибка сервера';
    case 'ROUTE_NOT_FOUND':
      return 'Маршрут не найден';
    case 'RATE_LIMIT':
      return 'Слишком много запросов. Попробуйте позже.';
    case 'REQUEST_CONFLICT':
      return 'Конфликт данных. Запись уже существует.';
    case 'FK_CONSTRAINT_FAILED':
      return 'Ссылка на связанный объект недействительна.';
    case 'AI_NOT_CONFIGURED':
      return 'AI-интеграция не настроена. Укажите OPENROUTER_API_KEY.';
    case 'AI_PROMPT_TOO_LONG':
      return `Входные данные слишком длинные. Максимум ${params.maxLength || 2000} символов.`;
    case 'AI_INVALID_GENERATION_TYPE':
      return 'Некорректный тип генерации.';
    case 'AI_EMPTY_RESPONSE':
      return 'AI вернул пустой ответ.';
    case 'AI_MALFORMED_RESPONSE':
      return 'AI вернул ответ в некорректном формате.';
    case 'AI_MODEL_UNAVAILABLE':
      return 'Текущая бесплатная модель недоступна. Выполняется переключение на следующую.';
    case 'AI_QUOTA_EXCEEDED':
      return 'Недостаточно квоты OpenRouter. Проверьте лимиты или подключите BYOK.';
    case 'AI_RATE_LIMIT':
      return 'Лимит AI-запросов исчерпан. Попробуйте позже.';
    case 'AI_TIMEOUT':
      return 'AI не ответил вовремя. Попробуйте снова.';
    case 'AI_CONTEXT_OVERFLOW':
      return 'Превышен контекст модели. Сократите входные данные.';
    case 'AI_DRAFT_NOT_FOUND':
      return 'Черновик AI-генерации не найден.';
    case 'AI_DRAFT_NOT_READY':
      return 'Черновик ещё не готов к подтверждению.';
    case 'AI_GENERATION_FAILED':
      return 'Не удалось сгенерировать контент через AI.';
    case 'REQUEST_ERROR':
    default:
      return params.fallback || 'Ошибка запроса';
  }
}
