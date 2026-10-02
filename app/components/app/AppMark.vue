<template>
  <span class="app-mark">
    <span class="app-mark__tile" aria-hidden="true">
      <Icon name="material-symbols:table-outline-rounded" />
    </span>
    <span class="app-mark__name">FlexBase</span>
  </span>
</template>

<style lang="scss" scoped>
.app-mark {
  display: inline-flex;
  align-items: center;
  gap: rem(10);
  min-width: 0;

  &__tile {
    display: grid;
    flex: none;
    place-items: center;
    width: rem(28);
    height: rem(28);
    border-radius: var(--radius-md);
    background: var(--color-accent);
    font-size: rem(18);
    color: var(--color-text-on-accent);
  }

  &__name {
    font-size: var(--font-size-body);
    font-weight: 600;
    color: var(--color-text);
  }
}
</style>
