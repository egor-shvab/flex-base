<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    :role="checked === undefined ? 'menuitem' : 'menuitemradio'"
    :aria-checked="checked"
    tabindex="-1"
    class="base-menu-item"
    :class="`base-menu-item--${tone}`"
    @click="choose"
  >
    <Icon v-if="icon" :name="icon" class="base-menu-item__icon" aria-hidden="true" />
    <slot />
  </component>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { NuxtLink } from '#components'
import { MENU_CLOSE_KEY } from '~/components/ui/BaseMenu/menu-close-key'

const props = withDefaults(
  defineProps<{
    to?: string
    icon?: string
    tone?: 'default' | 'accent' | 'danger'
    /** Set, even to `false`, the item is one radio of a group: `menuitemradio`. */
    checked?: boolean
    /** For an action whose result the open menu shows, such as a retry. */
    keepOpen?: boolean
  }>(),
  { to: undefined, icon: undefined, tone: 'default', checked: undefined, keepOpen: false },
)

const emit = defineEmits<{ click: [] }>()

const closeMenu = inject(MENU_CLOSE_KEY, () => {})

function choose() {
  if (!props.keepOpen) closeMenu()
  emit('click')
}
</script>

<style lang="scss" scoped>
.base-menu-item {
  display: flex;
  flex: none;
  align-items: center;
  gap: rem(10);
  width: 100%;
  min-height: var(--control-height);
  padding: rem(4) rem(8);
  border: none;
  border-radius: var(--radius-md);
  background: none;
  font: inherit;
  font-size: var(--font-size-md);
  color: var(--color-text);
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  @include focus-ring;

  &:hover {
    background: var(--color-surface-hover);
  }

  &[aria-checked='true'] {
    background: var(--color-accent-tint);
  }

  &--accent {
    font-weight: 600;
    color: var(--color-accent);

    &:hover {
      background: var(--color-accent-tint);
    }
  }

  &--danger {
    color: var(--color-danger);

    &:hover {
      background: var(--color-danger-tint);
    }
  }

  &__icon {
    flex: none;
    font-size: rem(18);
  }
}
</style>
