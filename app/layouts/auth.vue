<template>
  <div class="auth-layout">
    <main class="auth-layout__card">
      <slot />
    </main>
  </div>
</template>

<style lang="scss" scoped>
.auth-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: rem(16);
  background: var(--color-bg);

  &__card {
    width: 100%;
    max-width: rem(400);
    padding: rem(32);
    border-radius: rem(12);
    background: var(--color-surface);
    box-shadow: 0 4px 12px rgb(0 0 0 / 8%);
  }
}
</style>
