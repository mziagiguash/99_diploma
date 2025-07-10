<script>
  import { link, push } from "svelte-spa-router";
  import { formatDate, formatSearchResult, notePdfUrl } from "./lib";
  import { archiveNote, unarchiveNote } from "./api";
  import { createEventDispatcher } from "svelte";

  export let entry;
  export let isActive;

  const dispatch = createEventDispatcher();

  const archive = async () => {
    await archiveNote(entry._id);
    dispatch("routeEvent", { type: "note-archived", id: entry._id });
  };

  const unarchive = async () => {
    await unarchiveNote(entry._id);
    dispatch("routeEvent", { type: "note-unarchived", id: entry._id });
  };

  const edit = () => {
    push(`/note/${entry._id}/edit`);
  };

  async function downloadPdf(id) {
    const response = await fetch(`/notes/${id}/pdf`, {
      headers: { Accept: 'application/pdf' }
    });
    if (!response.ok) {
      alert('Ошибка при скачивании PDF');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `note-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
</script>

<a
  href={`/note/${entry._id}`}
  use:link
  class="uk-card uk-card-small uk-card-default uk-card-body uk-margin-top {isActive ? 'uk-card-primary' : 'uk-card-hover'} card-container"
>
  <h6 class="date">{entry.created ? formatDate(entry.created) : "Без даты"}</h6>
  <h4 class="title">
    {@html formatSearchResult(entry) || "<em>без заголовка</em>"}
  </h4>

  <div class="button-row">
    {#if entry.isArchived}
      <button
        class="uk-button uk-button-small uk-button-default"
        on:click|stopPropagation={unarchive}
      >
        📤 Восстановить
      </button>
    {:else}
      <button
        class="uk-button uk-button-small uk-button-default"
        on:click|stopPropagation={archive}
      >
        📦 В архив
      </button>
    {/if}

    <button
      class="uk-button uk-button-small uk-button-primary"
      on:click|stopPropagation={edit}
    >
      ✏️ Редактировать
    </button>

    <button
      class="uk-button uk-button-small uk-button-secondary"
      on:click|stopPropagation={() => downloadPdf(entry._id)}
    >
      📄 PDF
    </button>
  </div>
</a>

<style>
  .card-container {
    width: 100%;
  }

  .date {
    font-style: italic;
  }

  .title {
    margin-top: 0;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
</style>
