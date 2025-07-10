import _parseDate from "date-fns/parseISO";
import _formatDate from "date-fns/format";
import regexparam from "regexparam";


// routing
export const routePatterns = {
  new: "/new",
  edit: "/:id/edit",
  view: "/:id",
  archive: "/archive",
};

export const routerPrefix = "/note";

const routeRegexes = Object.keys(routePatterns).reduce((acc, p) => {
  acc[p] = regexparam(routePatterns[p]);
  return acc;
}, {});

const matchPattern = (path, { keys, pattern }) => {
  const matches = pattern.exec(path);
  if (!matches) return;

  let i = 0;
  const params = {};

  while (i < keys.length) {
    params[keys[i]] = matches[++i] || null;
  }

  return params;
};


export const getActiveNoteId = ($location) => {
  const loc = $location.replace(new RegExp("^" + routerPrefix), "");

  for (const p of [routeRegexes.view, routeRegexes.edit]) {
    const m = matchPattern(loc, p);
    if (m && m.id) {
      return m.id;
    }
  }

  return null;
};

// date formatting
export const formatDate = (date) => {
  if (!date) return "";
  const d = _parseDate(date);
  return _formatDate(d, "dd.MM.yyyy");
};

export const formatSearchResult = (entry) => {
  let title = entry.title || "";

  if (!entry.matches || !entry.matches.length) return escapeHtml(title);

  const pattern = new RegExp(`(${entry.matches.join("|")})`, "gi");

  return escapeHtml(title).replace(pattern, "<mark>$1</mark>");
};

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Пример правильной реализации:
export const notePdfUrl = (id) => `/notes/${id}/pdf`;
