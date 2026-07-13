export type UserNameParts = {
  lastName: string;
  firstName: string;
  middleName?: string | null;
};

export function formatUserName({ lastName, firstName, middleName }: UserNameParts) {
  return [lastName, firstName, middleName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}
