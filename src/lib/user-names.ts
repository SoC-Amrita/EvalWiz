export type NamedUser = {
  title?: string | null
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}

export function buildDisplayName({
  title,
  firstName,
  lastName,
  name,
}: NamedUser) {
  const parts = [title, firstName, lastName].filter(Boolean)
  if (parts.length > 0) {
    return parts.join(" ").replace(/\s+/g, " ").trim()
  }
  return name?.trim() || "Unknown User"
}

export function buildNameFields({
  title,
  firstName,
  lastName,
}: {
  title: string
  firstName: string
  lastName: string
}) {
  const normalizedTitle = title.trim()
  const normalizedFirstName = firstName.trim()
  const normalizedLastName = lastName.trim()

  return {
    title: normalizedTitle,
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    name: buildDisplayName({
      title: normalizedTitle,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    }),
  }
}
