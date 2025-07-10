<script>
  import { onMount, createEventDispatcher } from "svelte";
  import EasyMDE from "easymde";
  import Progress from "./Progress.svelte";
  import { getNote, editNote } from "./api";

  export let params;
  const dispatch = createEventDispatcher();

  let title = "";
  let textarea;
  let fetching;
  let mdEditor;

  onMount(() => {
    fetching = getNote(params.id).then((data) => {
      title = data.title;

      setTimeout(() => {
        // Убедимся, что textarea точно в DOM
        if (textarea) {
          mdEditor = new EasyMDE({
            element: textarea,
            forceSync: true,
            status: false,
            initialValue: data.text,
          });
        }
      }, 0); // сразу после отрисовки
    });

    return () => {
      try {
        mdEditor?.cleanup();
      } catch (_) {}
    };
  });

  const save = async () => {
    const text = mdEditor?.value()?.trim() || "";

    if (!title.trim() || !text) {
      alert("Заголовок и текст обязательны");
      return;
    }

    await editNote(params.id, title.trim(), text);
    dispatch("routeEvent", { type: "note-edited", id: params.id });
  };

  const cancel = () => {
    dispatch("routeEvent", { type: "note-edit-cancelled", id: params.id });
  };
</script>

{#await fetching}
  <Progress />
{:then _}
  <div class="uk-margin-bottom">
    <button on:click={save} class="uk-button uk-button-primary">
      💾 Сохранить
    </button>
    <button on:click={cancel} class="uk-button uk-button-default">
      ⬅️ Отмена
    </button>
  </div>

  <div class="uk-margin">
    <input
      bind:value={title}
      class="uk-input"
      type="text"
      placeholder="Заголовок"
    />
  </div>

  <div class="uk-margin">
    <textarea bind:this={textarea} class="uk-textarea" />
  </div>
{:catch error}
  <div class="uk-alert uk-alert-danger">
    <p>Ошибка загрузки заметки: {error.message}</p>
  </div>
{/await}
