<template>
  <span class="base-count"><slot /></span>
</template>

<style lang="scss" scoped>
.base-count {
  flex: none;
  min-width: rem(20);
  padding: 0 rem(6);
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: rem(20);
  color: var(--color-text-on-accent);
  text-align: center;
}
</style>
