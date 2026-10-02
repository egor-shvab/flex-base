<template>
  <nav class="auth-switch" aria-label="Log in or register">
    <NuxtLink to="/auth/login" class="auth-switch__link">Log in</NuxtLink>
    <NuxtLink to="/auth/register" class="auth-switch__link">Register</NuxtLink>
  </nav>
</template>

<style lang="scss" scoped>
.auth-switch {
  @include segmented-track;

  &__link {
    @include segmented-segment;

    flex: 1 1 0;
  }
}
</style>
