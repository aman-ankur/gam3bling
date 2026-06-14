type AvatarProps = {
  initials: string;
  tone?: "green" | "gold" | "blue" | "red" | string;
  label?: string;
};

export function Avatar({ initials, tone = "green", label }: AvatarProps) {
  return (
    <span
      aria-label={label ?? `${initials} avatar`}
      className="avatar"
      data-tone={tone}
      role="img"
    >
      {initials}
    </span>
  );
}
