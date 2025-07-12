<script>
  import Router, { link, location, push } from "svelte-spa-router";
  import { onMount } from "svelte";

  import { routerPrefix, routePatterns, getActiveNoteId } from "./lib";
  import { getNotes, deleteAllArchived } from "./api";

  import NoteCard from "./NoteCard.svelte";
  import Progress from "./Progress.svelte";
  import NoteView from "./NoteView.svelte";
  import NoteNew from "./NoteNew.svelte";
  import NoteEdit from "./NoteEdit.svelte";

  export const routes = {
    [routePatterns.new]: NoteNew,
    [routePatterns.view]: NoteView,
    [routePatterns.edit]: NoteEdit,
  };

  // Активная заметка из URL
  $: activeNoteId = getActiveNoteId($location);

  // Фильтр, поиск, пагинация, состояние загрузки и есть ли еще страницы
  let age = "1month";
  let search = "";
  let page = 1;
  let entries = [];
  let fetching = false;
  let hasMore = true;

  // Загрузка заметок с сервера
  const fetch = async ({ reset = false } = {}) => {
    if (fetching) return; // защита от параллельных вызовов
    try {
      fetching = true;
      if (reset) {
        page = 1;
        entries = [];
        hasMore = true;  // сбрасываем флаг наличия следующих страниц
      }
      const data = await getNotes({ filter: age, search, page });
      entries = reset ? data.data : [...entries, ...data.data];
      hasMore = data.hasMore;
    } catch (error) {
      console.error("Ошибка при загрузке заметок:", error);
      hasMore = false;
    } finally {
      fetching = false;
    }
  };

  // Загрузка с очисткой списка и сбросом навигации
  const fetchFromScratch = ({ resetNav = true } = {}) => {
    if (resetNav) push("/");
    return fetch({ reset: true });
  };

  // Загрузка следующей страницы
  const loadMore = () => {
    if (fetching || !hasMore) return;
    page += 1;
    fetch();
  };

  // Полный рефреш списка (например после удаления)
  const refetch = async () => {
    const oldPage = page;
    await fetchFromScratch({ resetNav: false });
    while (page < oldPage) {
      await loadMore();
    }
  };

  // Удаление всего архива и сброс фильтров
  const deleteAll = async () => {
    await deleteAllArchived();
    age = "1month";
    search = "";
    await fetchFromScratch();
  };

  // Обработка событий роутинга, управление навигацией и обновлением списка
  const routeEvent = (event) => {
    const { type, id } = (event && event.detail) || {};
    switch (type) {
      case "note-create-cancelled":
      case "note-closed":
        push("/");
        break;
      case "note-deleted":
      case "note-archived":
      case "note-unarchived":
        push("/");
        refetch();
        break;
      case "note-edit-started":
        push(`/note/${id}/edit`);
        break;
      case "note-edit-cancelled":
        push(`/note/${id}`);
        break;
      case "note-created":
      case "note-edited":
        push(`/note/${id}`);
        refetch();
        break;
    }
  };

  // Дебаунс для запросов при изменении фильтра или поиска
  let fetchTimeout;
  $: if (age || search) {
    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
      fetchFromScratch();
    }, 300);
  }

  // Начальная загрузка при монтировании компонента
  onMount(() => {
    fetchFromScratch();
  });
</script>

<section class="uk-flex uk-grid-collapse">
  <aside class="uk-width-1-4 uk-padding-small">
    {#if age !== 'archive'}
      {#if activeNoteId === 'new'}
        <button disabled class="uk-button uk-button-primary uk-display-block uk-width-1-1">
          Новая заметка
        </button>
      {:else}
        <a use:link={'/note/new'} href="/" class="uk-button uk-button-primary uk-display-block uk-width-1-1">
          Новая заметка
        </a>
      {/if}
    {:else}
      <button on:click={deleteAll} class="uk-button uk-button-secondary uk-display-block uk-width-1-1">
        Удалить весь архив
      </button>
    {/if}

    <p>
      <select bind:value={age} class="uk-select">
        <option value="1month">за месяц</option>
        <option value="3months">за 3 месяца</option>
        <option value="alltime">за всё время</option>
        <option value="archive">архив</option>
      </select>
    </p>

    <p class="uk-search uk-search-default uk-width-1-1">
      <i uk-search-icon class="uk-icon uk-search-icon fas fa-search" />
      <input
        bind:value={search}
        class="uk-search-input uk-width-1-1"
        type="search"
        placeholder="Поиск по заголовку"
      />
    </p>

    {#each entries as entry (entry._id)}
      <NoteCard {entry} isActive={entry._id === activeNoteId} />
    {/each}

    {#if fetching}
      <Progress />
    {/if}

    {#if hasMore && !fetching}
      <button
        on:click={loadMore}
        class="uk-button uk-button-secondary uk-margin-top uk-display-block uk-width-1-1"
      >
        Загрузить ещё&hellip;
      </button>
    {/if}
  </aside>

  <div class="uk-width-3-4 uk-padding-small">
    <Router
      {routes}
      prefix={routerPrefix}
      on:routeEvent={routeEvent}
      on:routeLoaded={() => window.scrollTo(0, 0)}
    />
  </div>
</section>
