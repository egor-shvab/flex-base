/** One subpage of `/ui-test`: where it lives, and which `common/` components it shows. */
export interface IUiTestSection {
  path: string
  label: string
  components: string[]
}

/**
 * The showcase's subpages, read by both the section nav and the overview. Every component in
 * `app/components/common/` appears in exactly one entry.
 */
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
