<template>
  <div class="auth-layout">
    <div class="auth-layout__column">
      <AppMark class="auth-layout__mark" />
      <main class="auth-layout__card">
        <slot />
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.auth-layout {
  @include centred-viewport;

  &__column {
    @include centred-column(rem(412));
  }

  &__mark {
    align-self: center;
  }

  &__card {
    @include centred-card;
  }

  @include below-compact {
    background: var(--color-surface);

    &__card {
      padding: 0;
      border: none;
    }
  }
}
</style>
