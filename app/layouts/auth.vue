<template>
  <div class="auth-layout">
    <main class="auth-layout__card">
      <slot />
    </main>
  </div>
</template>

<style lang="scss" scoped>
.auth-layout {
  @include centred-viewport;

  &__card {
    @include centred-card(rem(400));
  }
}
</style>
