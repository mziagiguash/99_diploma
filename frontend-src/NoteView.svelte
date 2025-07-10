<script>
  import { createEventDispatcher } from "svelte";
  import { getNote, archiveNote, unarchiveNote, deleteNote } from "./api";
  import { notePdfUrl } from "./lib";
  import Progress from "./Progress.svelte";
  import { marked } from "marked";

  export let params;
  const dispatch = createEventDispatcher();

  $: p = getNote(params.id);

  const close = () =>
    dispatch("routeEvent", { type: "note-closed", id: params.id });

  const doArchive = async () => {
    await archiveNote(params.id);
    dispatch("routeEvent", { type: "note-archived", id: params.id });
  };

  const doUnarchive = async () => {
    await unarchiveNote(params.id);
    dispatch("routeEvent", { type: "note-unarchived", id: params.id });
  };

  const doDelete = async () => {
    if (confirm("Удалить эту заметку навсегда?")) {
      await deleteNote(params.id);
      dispatch("routeEvent", { type: "note-deleted", id: params.id });
    }
  };

  const doEdit = () =>
    dispatch("routeEvent", { type: "note-edit-started", id: params.id });
</script>

{#await p}
  <Progress />
{:then entry}
  {#if entry}
    <h1>{entry.title}</h1>

    <div class="uk-card uk-card-default uk-card-body markdown">
      {@html marked(entry.text || "*Пустое содержимое*")}
    </div>

    <div class="uk-margin-top uk-button-group" style="flex-wrap: wrap; gap: 8px;">
      {#if entry.isArchived}
        <button on:click={doDelete} class="uk-button uk-button-danger">
          🗑 Удалить
        </button>
        <button on:click={doUnarchive} class="uk-button uk-button-default">
          📤 Восстановить
        </button>
      {:else}
        <button on:click={doArchive} class="uk-button uk-button-default">
          📦 В архив
        </button>
      {/if}

      <button on:click={doEdit} class="uk-button uk-button-primary">
        ✏️ Редактировать
      </button>
      <button on:click={close} class="uk-button uk-button-default">
        ❌ Закрыть
      </button>
      <a href={notePdfUrl(entry._id)} class="uk-button uk-button-secondary">
        📄 PDF
      </a>
    </div>
  {:else}
    <div class="uk-alert uk-alert-warning">
      <p>Заметка не найдена.</p>
    </div>
  {/if}
{:catch error}
  <div class="uk-alert uk-alert-danger">
    <p>Ошибка: {error.message}</p>
  </div>
{/await}
