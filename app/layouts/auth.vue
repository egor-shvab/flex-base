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
  background: var(--color-canvas);

  &__card {
    width: 100%;
    max-width: rem(400);
    padding: rem(32);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }
}
</style>
