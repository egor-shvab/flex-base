<template>
  <div class="base-empty-state">
    <!-- Decoration: the title and the message say everything this names. `aria-hidden` matters
         more here than it usually does — the records page renders this component *as* a
         `role="status"` live region, and the tile must add nothing to what it announces. -->
    <span class="base-empty-state__art">
      <Icon :name="icon" aria-hidden="true" />
    </span>

    <p v-if="title" class="base-empty-state__title">{{ title }}</p>

    <!-- The wrapper is load-bearing now that the root is a flex column: a flex container
         blockifies its *direct* children, so a bare slot would put each run of a message mixing
         text with an inline link on a line of its own. Inside this `<p>` they stay inline. -->
    <p class="base-empty-state__message"><slot /></p>

    <div v-if="$slots.action" class="base-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  /**
   * Iconify name (`mdi:*`) for the tile above the copy. Required, not optional: an empty state
   * names what is missing, and the glyph is half of how it says it.
   */
  icon: string
}>()
</script>

<style lang="scss" scoped>
.base-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: rem(8);
  margin: rem(40) 0;
  // The measure below is what stops long copy running the width of the pane; this is what keeps
  // it off the edges when the pane is narrower than the measure
  padding-inline: rem(28);
  text-align: center;
  color: var(--color-text-secondary);

  &__art {
    display: grid;
    place-items: center;
    width: rem(56);
    height: rem(56);
    // A step over the shared gap: the tile is the block's opening, not one of its lines
    margin-bottom: rem(6);
    border-radius: var(--radius-lg);
    background: var(--color-accent-tint);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
    font-size: rem(28);
    color: var(--color-accent);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  &__message {
    // Centred copy is unreadable past a measure, and this block is as wide as whatever contains it
    max-width: 42ch;
    margin: 0;
  }

  &__action {
    display: flex;
    justify-content: center;
    gap: rem(8);
    margin-top: rem(6);
  }
}
</style>
