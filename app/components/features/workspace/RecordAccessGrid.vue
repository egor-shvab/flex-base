<template>
  <BaseCard class="record-access-grid">
    <div class="record-access-grid__grid">
      <div class="record-access-grid__head" aria-hidden="true">
        <span>{{ subjectLabel }}</span>
        <span v-for="key in COLUMN_KEYS" :key="key">{{ RECORD_ACCESS_TEXT[key].label }}</span>
      </div>
      <slot />
    </div>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
import { RECORD_ACCESS_TEXT } from '~/utils/workspace-permissions'

/**
 * The card record access is set in: a head naming the four columns, and rows (`RecordAccessRow`)
 * each holding one subject — a table of a role, or a role of a table. Below its own width the grid
 * folds to two columns and each control shows its column's word.
 */
defineProps<{
  /** The first column's head: what each row is. */
  subjectLabel: string
}>()

const COLUMN_KEYS = ['readScope', 'canCreate', 'updateScope', 'deleteScope'] as const
</script>

<style lang="scss" scoped>
.record-access-grid {
  @include access-grid-container;

  &__grid {
    --access-grid-columns: minmax(#{rem(150)}, 1fr) repeat(4, #{rem(108)});

    @include below-access-grid {
      --access-grid-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__head {
    display: grid;
    grid-template-columns: var(--access-grid-columns);
    gap: rem(8);
    align-items: center;
    padding: rem(10) rem(16);
    border-bottom: 1px solid var(--color-border-subtle);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);

    @include below-access-grid {
      display: none;
    }
  }
}
</style>
