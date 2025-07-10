const PREFIX = "/notes";

// Общая функция запроса
const req = (url, options = {}) => {
  const { body } = options;

  // Корректируем URL — избегаем двойного слеша в конце
  const fullUrl = (PREFIX + url).replace(/\/{2,}/g, "/");

  const fetchOptions = {
    ...options,
    headers: {
      ...options.headers,
      ...(body
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  };

  return fetch(fullUrl, fetchOptions).then(async (res) => {
    if (res.ok) {
      // Пытаемся распарсить JSON, если есть тело
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } else {
      const message = await res.text();
      throw new Error(message);
    }
  });
};


// 🔍 Получение списка заметок
export const getNotes = ({ filter = "1month", search = "", page = 1 } = {}) => {
  const params = new URLSearchParams();
  if (filter) params.append("filter", filter);
  if (search) params.append("search", search);
  if (page) params.append("page", page);

  return req("/?" + params.toString()).then((res) => {
    const raw = res.data || res;

    // 🔎 Фильтрация: архивные заметки показываем только при filter === 'archive'
    const cleaned = raw.filter((n) => {
      const isArchived = !!(n.isArchived || n.archived || n.archived_at);
      return filter === "archive" ? isArchived : !isArchived;
    });

    return {
      data: cleaned.map((n) => ({
        ...n,
        _id: n.id,
        created: n.created || n.created_at,
        isArchived: !!(n.isArchived || n.archived || n.archived_at),
        matches: n.matches || [], // 🔍 получаем matches от сервера, если есть
      })),
      hasMore: raw.length === 20,
    };
  });
};

// 📝 Создание новой заметки
export const createNote = (title, text) =>
  req("/", {
    method: "POST",
    body: { title, text },
  });

// 📄 Получение одной заметки
export const getNote = (id) =>
  req(`/${id}`).then((n) => ({
    ...n,
    _id: n.id,
    created: n.created || n.created_at,
    isArchived: n.isArchived || n.archived || n.archived_at ? true : false,
  }));

// ✏️ Редактирование
export const editNote = (id, title, text) =>
  req(`/${id}`, {
    method: "PUT",
    body: { title, text },
  }).then((n) => ({
    ...n,
    _id: n.id,
    created: n.created || n.created_at,
    isArchived: n.isArchived || n.archived || n.archived_at ? true : false,
  }));

// 📦 Архивировать
export const archiveNote = (id) =>
  req(`/${id}/archive`, {
    method: "POST",
  });

// 🔄 Восстановить из архива
export const unarchiveNote = (id) =>
  req(`/${id}/restore`, {
    method: "POST",
  });

// 🗑 Удалить одну заархивированную
export const deleteNote = (id) =>
  req(`/${id}`, {
    method: "DELETE",
  });

// 🗑 Удалить все заархивированные
export const deleteAllArchived = () =>
  req("", {
    method: "DELETE",
  });

// 📄 Ссылка для скачивания PDF
export const notePdfUrl = (id) => `/notes/${id}/pdf`;



