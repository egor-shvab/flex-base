<template>
  <div class="base-empty-state">
    <!-- Decoration. `aria-hidden` matters more than usual: the records page renders this
         component *as* a `role="status"` region, and the tile must add nothing to it. -->
    <span class="base-empty-state__art">
      <Icon :name="icon" aria-hidden="true" />
    </span>

    <p v-if="title" class="base-empty-state__title">{{ title }}</p>

    <!-- Load-bearing: the root is a flex column, which blockifies its direct children, so a
         bare slot would put each run of a message with an inline link on its own line. -->
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
   * Iconify name (`mdi:*`) for the tile above the copy. Required: the glyph is half of how an
   * empty state says what is missing.
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
  // Keeps the copy off the edges where the pane is narrower than the measure below
  padding-inline: rem(28);
  text-align: center;
  color: var(--color-text-secondary);

  &__art {
    display: grid;
    place-items: center;
    width: rem(56);
    height: rem(56);
    // A step over the shared gap — the tile opens the block rather than being a line of it
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
    // Centred copy is unreadable past a measure, and this block is as wide as its container
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
