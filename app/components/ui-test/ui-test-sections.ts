export interface IUiTestSection {
  path: string
  label: string
  components: string[]
}

export const UI_TEST_SECTIONS: IUiTestSection[] = [
  { path: '/ui-test/buttons', label: 'Buttons', components: ['BaseButton'] },
  {
    path: '/ui-test/inputs',
    label: 'Inputs',
    components: ['BaseInput', 'BaseCheckbox', 'BaseRange', 'BaseSegmented', 'BaseColorPicker'],
  },
  { path: '/ui-test/select', label: 'Select', components: ['BaseSelect'] },
  {
    path: '/ui-test/display',
    label: 'Display',
    components: ['BaseBadge', 'BaseLinkedRecord', 'BaseErrorBanner', 'BaseEmptyState'],
  },
  {
    path: '/ui-test/navigation',
    label: 'Navigation',
    components: ['BaseBreadcrumbs', 'BasePagination'],
  },
  { path: '/ui-test/overlays', label: 'Overlays', components: ['BaseModal'] },
]
