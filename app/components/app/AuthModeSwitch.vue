<template>
  <nav class="auth-mode-switch" aria-label="Log in or register">
    <NuxtLink to="/auth/login" class="auth-mode-switch__link">Log in</NuxtLink>
    <NuxtLink to="/auth/register" class="auth-mode-switch__link">Register</NuxtLink>
  </nav>
</template>

<style lang="scss" scoped>
.auth-mode-switch {
  @include segmented-track;

  &__link {
    @include segmented-segment;

    flex: 1 1 0;
  }
}
</style>
