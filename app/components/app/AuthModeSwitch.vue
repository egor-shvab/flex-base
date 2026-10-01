<template>
  <!--
    Two routes, so two links — a radiogroup would announce a value to choose where there is a
    page to go to. `NuxtLink` marks the exact-active one `aria-current="page"`, which is the
    state the segment mixin draws, so the look cannot disagree with what is announced.
  -->
  <nav class="auth-switch" aria-label="Log in or register">
    <NuxtLink to="/auth/login" class="auth-switch__link">Log in</NuxtLink>
    <NuxtLink to="/auth/register" class="auth-switch__link">Register</NuxtLink>
  </nav>
</template>

<style lang="scss" scoped>
.auth-switch {
  @include segmented-track;

  // Equal halves, so it reads as one control with two sides
  &__link {
    @include segmented-segment;

    flex: 1 1 0;
  }
}
</style>
