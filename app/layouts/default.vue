<template>
  <div class="app-layout">
    <header class="app-layout__header">
      <NuxtLink to="/" class="app-layout__brand">FlexBase</NuxtLink>

      <div v-if="auth.isAuthenticated" class="app-layout__user">
        <span class="app-layout__email">{{ auth.user?.email }}</span>
        <button type="button" class="app-layout__logout" @click="auth.logout()">Log out</button>
      </div>
    </header>

    <main class="app-layout__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
</script>

<style lang="scss" scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-canvas);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: rem(12) rem(24);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  &__brand {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-accent);
    text-decoration: none;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: rem(12);
  }

  &__email {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__logout {
    padding: rem(6) rem(12);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    cursor: pointer;

    &:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }
  }

  &__main {
    flex: 1;
    padding: rem(24);
  }
}
</style>
