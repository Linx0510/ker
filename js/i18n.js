const CATEGORY_LABELS = {
  plita: 'Керамическая плитка',
  keramogranit: 'Керамогранит',
  santehnika: 'Сантехника',
  decor: 'Мозаика и декор',
  montazh: 'Технологии укладки',
  commercial: 'Коммерческие помещения'
};

const LEVEL_LABELS = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый'
};

const STATUS_LABELS = {
  pending: 'Ожидает подтверждения',
  active: 'Активен'
};

const NAV_LABELS = {
  home: 'Главная',
  courses: 'Мои курсы',
  dashboard: 'Личный кабинет',
  profile: 'Профиль',
  admin: 'Админ-панель',
  login: 'Войти',
  register: 'Регистрация',
  logout: 'Выйти'
};

const ERROR_MESSAGES = {
  FIELD_REQUIRED: 'Заполните обязательное поле',
  EMAIL_REQUIRED: 'Укажите email',
  EMAIL_INVALID: 'Некорректный email',
  EMAIL_DOMAIN_FORBIDDEN: 'Регистрация доступна только для корпоративных email',
  PASSWORD_TOO_SHORT: 'Пароль должен содержать не менее 8 символов',
  EMAIL_EXISTS: 'Пользователь с таким email уже существует',
  NOT_FOUND: 'Запись не найдена',
  USER_NOT_FOUND: 'Пользователь не найден',
  INVALID_STATE: 'Недопустимое состояние',
  ADMIN_ALREADY_ACTIVE: 'Администратор уже активен',
  DEPARTMENT_NOT_FOUND: 'Отдел не найден',
  POSITION_NOT_FOUND: 'Должность не найдена',
  POSITION_DEPARTMENT_MISMATCH: 'Выбранная должность не относится к указанному отделу',
  INVALID_PASSWORD: 'Текущий пароль указан неверно',
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  AUTHENTICATION_REQUIRED: 'Требуется авторизация',
  ACCOUNT_PENDING: 'Учётная запись ожидает подтверждения администратором',
  INVALID_TOKEN: 'Недействительный или просроченный токен',
  FORBIDDEN: 'Доступ запрещён',
  REFRESH_TOKEN_MISSING: 'Токен обновления отсутствует',
  REFRESH_TOKEN_INVALID: 'Недействительный токен обновления',
  SELF_ENROLLMENT_DISABLED: 'Самостоятельная запись на курс отключена. Обратитесь к администратору.',
  CANNOT_DELETE_SELF: 'Нельзя удалить свою учётную запись',
  DEPARTMENT_EXISTS: 'Отдел с таким названием уже существует',
  POSITION_EXISTS: 'Должность с таким названием уже есть в этом отделе',
  COURSE_NOT_FOUND: 'Курс не найден',
  LESSON_NOT_FOUND: 'Урок не найден',
  INVALID_NUMBER: 'Укажите корректное число',
  COURSE_NOT_ASSIGNED: 'Курс не назначен. Обратитесь к администратору.',
  ASSIGNMENT_NOT_FOUND: 'Назначение не найдено',
  UNABLE_TO_ASSIGN: 'Не удалось назначить курс',
  TEST_FAILED: 'Результат теста ниже проходного порога',
  CERTIFICATE_NOT_READY: 'Сертификат доступен только для завершённых курсов',
  CERTIFICATE_FONT_MISSING: 'Не найдены шрифты для генерации PDF. Обратитесь к администратору.',
  ANSWER_OPTIONS_REQUIRED: 'Нужно не менее двух вариантов ответа',
  INVALID_ANSWER_INDEX: 'Некорректный индекс правильного ответа',
  REQUEST_CONFLICT: 'Конфликт данных. Запись уже существует',
  FK_CONSTRAINT_FAILED: 'Неверные связанные данные',
  AI_NOT_CONFIGURED: 'AI не настроен на сервере',
  AI_PROMPT_TOO_LONG: 'Слишком длинный prompt',
  AI_INVALID_GENERATION_TYPE: 'Некорректный тип генерации',
  AI_EMPTY_RESPONSE: 'AI вернул пустой ответ',
  AI_MALFORMED_RESPONSE: 'AI вернул некорректный ответ',
  AI_MODEL_UNAVAILABLE: 'Текущая бесплатная модель недоступна, пробуем следующую',
  AI_QUOTA_EXCEEDED: 'Недостаточно квоты OpenRouter, проверьте лимиты',
  AI_RATE_LIMIT: 'Лимит AI-запросов исчерпан',
  AI_TIMEOUT: 'AI не ответил вовремя',
  AI_CONTEXT_OVERFLOW: 'Превышен контекст модели',
  AI_DRAFT_NOT_FOUND: 'Черновик не найден',
  AI_DRAFT_NOT_READY: 'Черновик ещё не готов',
  AI_GENERATION_FAILED: 'Не удалось выполнить AI-генерацию',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера',
  ROUTE_NOT_FOUND: 'Маршрут не найден',
  RATE_LIMIT: 'Слишком много запросов. Попробуйте позже.',
  REQUEST_ERROR: 'Не удалось выполнить запрос'
};

function formatError(error) {
  if (!error) return ERROR_MESSAGES.REQUEST_ERROR;
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  if (error.message && /[а-яА-ЯёЁ]/.test(error.message)) {
    return error.message;
  }
  return ERROR_MESSAGES.REQUEST_ERROR;
}

window.i18n = {
  category: (key) => CATEGORY_LABELS[key] || key,
  level: (key) => LEVEL_LABELS[key] || key,
  status: (key) => STATUS_LABELS[key] || key,
  nav: (key) => NAV_LABELS[key] || key,
  formatError,
  errors: ERROR_MESSAGES,
  t: {
    loadingCourses: 'Загрузка курсов...',
    noCourses: 'Назначенных курсов пока нет',
    loadError: 'Не удалось загрузить данные. Попробуйте обновить страницу.',
    details: 'Открыть курс',
    welcome: 'Добро пожаловать',
    completed: 'Завершён',
    notAssigned: 'Курс не назначен. Обратитесь к администратору.',
    completeLesson: 'Завершить урок',
    lessonTest: 'Проверка знаний',
    submitTest: 'Отправить ответы',
    testPassed: 'Тест пройден',
    testFailed: 'Неверные ответы. Попробуйте ещё раз.',
    prevLesson: 'Предыдущий урок',
    nextLesson: 'Следующий урок',
    backToCourse: 'К курсу',
    saving: 'Сохранение...',
    saved: 'Сохранено',
    passwordsMismatch: 'Пароли не совпадают',
    selectDepartmentFirst: 'Сначала выберите отдел',
    registrationPending: 'Регистрация отправлена. Ожидайте подтверждения администратором.',
    registrationComplete: 'Регистрация завершена. Перенаправление...',
    progressLabel: 'Прогресс',
    testRequiredBadge: 'Тест обязателен',
    lessonTestMissing: 'Тест для этого урока пока не опубликован.',
    lessonTestAvailableState: 'Тест опубликован. Ответьте на вопросы, чтобы завершить урок.',
    lessonTestPassedState: 'Тест уже пройден. При необходимости можно пересдать.',
    retakeTest: 'Пересдать тест',
    retakeConfirm: 'Пересдать тест? Результат будет обновлён.',
    retakeStarted: 'Режим пересдачи включён. Отправьте новые ответы.',
    testRetakeSaved: 'Результат пересдачи сохранён',
    addUser: 'Добавить сотрудника',
    addCourse: 'Добавить курс',
    editCourse: 'Редактировать курс',
    saveCourse: 'Сохранить курс',
    addLesson: 'Добавить урок',
    editLesson: 'Редактировать урок',
    saveLesson: 'Сохранить урок',
    assignCourse: 'Назначить курс',
    selectUser: 'Выберите сотрудника',
    selectCourse: 'Выберите курс',
    directories: 'Справочники',
    departments: 'Отделы',
    positions: 'Должности',
    addDepartment: 'Добавить отдел',
    editDepartment: 'Редактировать отдел',
    addPosition: 'Добавить должность',
    editPosition: 'Редактировать должность',
    departmentName: 'Название отдела',
    positionName: 'Название должности',
    selectDepartment: 'Выберите отдел',
    videoUrl: 'Ссылка на видео (YouTube, Vimeo или прямая)',
    cancel: 'Отмена',
    save: 'Сохранить',
    deleteConfirmDepartment: 'Удалить отдел?',
    deleteConfirmPosition: 'Удалить должность?'
  }
};
