<script>
  import { onMount, createEventDispatcher } from "svelte";
  import EasyMDE from "easymde";
  import { createNote } from "./api";
  import Progress from "./Progress.svelte";



  const dispatch = createEventDispatcher();

  let title = "";
  let textarea;
  let mdEditor;
  let error = null;
  let loading = false;

  onMount(() => {
    mdEditor = new EasyMDE({
      element: textarea,
      forceSync: true,
      status: false,
    });

    return () => mdEditor?.cleanup();
  });

  const save = async () => {
    const text = mdEditor?.value()?.trim() || "";
    const trimmedTitle = title.trim();

    if (!trimmedTitle || !text) {
      error = "Заголовок и текст обязательны";
      return;
    }

    loading = true;
    try {
      const note = await createNote(trimmedTitle, text);
      dispatch("routeEvent", {
        type: "note-created",
        id: note._id || note.id,
      });
    } catch (err) {
      error = "Ошибка при создании заметки: " + err.message;
    } finally {
      loading = false;
    }
  };

  const cancel = () => {
    dispatch("routeEvent", {
      type: "note-create-cancelled",
    });
  };
</script>

{#if loading}
  <Progress />
{:else}
  {#if error}
    <div class="uk-alert uk-alert-danger" uk-alert>
      <p>{error}</p>
    </div>
  {/if}

  <form on:submit|preventDefault={save} class="uk-margin-bottom">
    <div class="uk-margin">
      <input
        type="text"
        bind:value={title}
        placeholder="Заголовок"
        class="uk-input"
      />
    </div>

    <div class="uk-margin">
      <textarea bind:this={textarea} class="uk-textarea" />
    </div>

    <div class="uk-button-group uk-margin-top">
      <button type="submit" class="uk-button uk-button-primary">
        💾 Сохранить
      </button>
      <button
        type="button"
        on:click={cancel}
        class="uk-button uk-button-default"
      >
        ⬅️ Отмена
      </button>
    </div>
  </form>
{/if}
