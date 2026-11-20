export interface IAuthUser {
  id: string
  email: string
  name: string
}

/** Who did something, as other people may see them — never the email. */
export interface IUserRef {
  id: string
  name: string
}
