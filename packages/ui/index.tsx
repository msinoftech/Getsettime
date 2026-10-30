export const Button = ({children}:{children:React.ReactNode}) => (
  <button className="px-3 py-1 rounded-md">{children}</button>
);

export { Pagination } from "./src/Pagination";
export { usePagination } from "./src/usePagination";
export { UserAvatar } from "./src/UserAvatar";
export type { UserAvatarProps, UserAvatarSize, UserAvatarShape } from "./src/UserAvatar";
export { userInitials, userInitialChar } from "./src/userInitials";
